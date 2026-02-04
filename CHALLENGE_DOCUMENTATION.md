# Challenge System Documentation

## Overview

The challenge system protects the application from bot traffic by requiring users from bot IP addresses to complete an hCaptcha verification. Once verified, a secure cookie is set that allows access for a limited time period.

## Architecture

### Components

1. **Nginx** - Frontend proxy that checks bot IPs and routes requests
2. **Node.js Backend** - Handles challenge page, verification, and cookie validation
3. **hCaptcha** - Third-party CAPTCHA service
4. **Redis** - Stores bot IP addresses detected by the API and verified IP whitelist
5. **Bot IP Detection Job** - Periodically updates bot IP list from Redis
6. **IP Whitelist Job** - Daily updates whitelist map from verified IPs in Redis

## Flow Diagram

```
User Request
    ↓
Nginx checks if IP is bot IP (geo $is_bot_ip)
    ↓
Checks whitelist.map first → If whitelisted → Allow access
    ↓
If bot IP → auth_request /_captcha_check
    ↓
Backend checks cookie
    ↓
No cookie or invalid → 401 → Redirect to /challenge
    ↓
User completes hCaptcha → POST /captcha/verify
    ↓
Backend verifies with hCaptcha API
    ↓
Success → Add IP to Redis whitelist → Set cookie → Redirect
    ↓
Daily job (03:00) → Generate whitelist.map → Clear Redis key
    ↓
Next request → IP whitelisted → Access granted (no cookie needed)
```

## Bot IP Detection

### Source: `src/jobs/updateBotIps.js`

The system periodically fetches bot IP addresses from Redis and generates an nginx map file.

**Configuration:**
- `REDIS_KEY` - Redis key containing bot IPs (default: `api_bot_detection`)
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB` - Redis connection settings
- `BOT_IPS_MAP_PATH` - Output path for nginx map file (default: `/etc/nginx/bot_ips.map`)
- `UPDATE_INTERVAL` - Cron schedule (default: `*/5 * * * *` - every 5 minutes)

**IP Aggregation Logic:**

1. **First Level Aggregation:**
   - Single IPv4 IPs (`/32`) → aggregated to `/24` subnet
   - Single IPv6 IPs (`/128`) → aggregated to `/64` subnet

2. **Second Level Aggregation:**
   - Multiple `/24` IPv4 subnets → aggregated to `/12` if threshold met (default: 20 subnets)
   - Multiple `/64` IPv6 subnets → aggregated to `/32` if threshold met (default: 30 subnets)

**Output Format:**
The job generates `/etc/nginx/maps/bot_ips.map` file in nginx map format:
```
192.168.1.0/24 1;
10.0.0.0/12 1;
2001:db8::/64 1;
```

## IP Whitelist System

### Source: `src/jobs/updateWhitelist.js` and `src/controllers/captchaController.js`

The system maintains a whitelist of IPs that have successfully verified captcha. These IPs bypass bot detection entirely.

**How it works:**

1. **On Captcha Verification:**
   - When user successfully completes hCaptcha verification, their IP is added to Redis SET `captcha_whitelist`
   - IP is extracted from `X-Real-IP` header or `request.ip`

2. **Daily Whitelist Update:**
   - Job runs daily at 03:00 (configurable)
   - Reads all IPs from Redis SET `captcha_whitelist`
   - Generates `/etc/nginx/maps/whitelist.map` file
   - Limits to 200,000 IPs (configurable via `WHITELIST_MAP_MAX_LINES`)
   - Removes written IPs from Redis after successful update
   - If more than 200,000 IPs exist, remaining IPs stay in Redis for next cycle

**Configuration:**
- `REDIS_WHITELIST_KEY` - Redis key for whitelist (default: `captcha_whitelist`)
- `WHITELIST_MAP_PATH` - Output path for nginx map file (default: `/etc/nginx/maps/whitelist.map`)
- `WHITELIST_MAP_MAX_LINES` - Maximum IPs in map file (default: `200000`)
- `WHITELIST_UPDATE_INTERVAL` - Cron schedule (default: `0 3 * * *` - daily at 03:00)

**Output Format:**
The job generates `/etc/nginx/maps/whitelist.map` file in nginx geo format:
```
200.123.1.1 0;
192.168.0.5 0;
10.0.0.1 0;
```

**Redis Client:**
- Shared Redis client module: `src/common/helpers/redisClient.js`
- Used by both bot IP detection and whitelist jobs, and captcha controller
- Handles connection pooling, error recovery, and reconnection
- Singleton pattern ensures single Redis connection per process
- Automatically reconnects on connection loss

## Nginx Configuration

### Bot IP Detection: `nginx/*/http.d/hcaptcha.conf`

```nginx
geo $is_bot_ip {
    default 0;
    include /etc/nginx/maps/whitelist.map;
    include /etc/nginx/maps/bot_ips.map;
    include /etc/nginx/maps/bot_ips_overflow.map;
}
```

**Evaluation Order:**
1. Checks `whitelist.map` first - if IP matches, returns `0` (not bot)
2. Checks `bot_ips.map` - if IP matches, returns `1` (bot)
3. Checks `bot_ips_overflow.map` - if IP matches, returns `1` (bot)
4. Default: `0` (not bot)

- `$is_bot_ip = 1` if IP is in bot list (and not whitelisted)
- `$is_bot_ip = 0` if IP is whitelisted or not in bot list

**Important:** Whitelist entries take precedence over bot IP entries. If an IP is in both whitelist and bot list, it will be treated as whitelisted (not bot).

### Server Configuration: `nginx/*/snippets/waivio-server.conf`

#### 1. Challenge Page (`/challenge`)

Serves the challenge HTML page from backend:
```nginx
location = /challenge {
    proxy_pass       http://captcha_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    add_header       Cache-Control "no-store";
}
```

#### 2. Verification Endpoint (`/captcha/verify`)

Handles POST requests with hCaptcha token:
```nginx
location = /captcha/verify {
    proxy_pass       http://captcha_backend;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_redirect   off;
    proxy_intercept_errors off;
    proxy_http_version 1.1;
    proxy_pass_header Set-Cookie;
    proxy_cookie_path / /;
}
```

**Important settings:**
- `proxy_redirect off` - Prevents nginx from following redirects, passes them to client
- `proxy_pass_header Set-Cookie` - Ensures Set-Cookie header is passed to client
- `proxy_cookie_path / /` - Preserves cookie path

#### 3. Cookie Check (`/_captcha_check`)

Internal endpoint for `auth_request`:
```nginx
location = /_captcha_check {
    internal              ;
    proxy_pass            http://captcha_backend;
    proxy_set_header      Host $host;
    proxy_set_header      X-Real-IP $remote_addr;
    proxy_set_header      X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header      X-Is-Bot-IP $is_bot_ip;
    proxy_set_header      Cookie $http_cookie;
    proxy_connect_timeout 1s;
    proxy_read_timeout    1s;
}
```

**Headers passed:**
- `X-Is-Bot-IP` - `1` if IP is bot IP, otherwise not set
- `Cookie` - All cookies from client request

**Response codes:**
- `204` - Cookie valid or not bot IP, allow access
- `401` - Cookie missing or invalid, require challenge

#### 4. Protected Locations

Locations protected by challenge:
```nginx
location / {
    auth_request       /_captcha_check;
    error_page         401 @captcha_redirect;
    proxy_pass         http://waivio_frontend;
}
```

**Flow:**
1. Nginx calls `auth_request /_captcha_check`
2. If returns `401` → redirects to `/challenge?rd=$rd_uri`
3. If returns `204` → proceeds with proxy_pass

## Challenge Page

### Source: `public/challenge.html` and `src/routes/challenge.js`

**Route:** `GET /challenge`

**Query Parameters:**
- `rd` - Redirect destination after successful verification (default: `/`)
- `error` - Error type (`verification_failed`, `server_error`)

**Features:**
- hCaptcha widget with site key from `HCAPTCHA_SITE_KEY` environment variable
- Hidden form for submitting verification token
- Error message display
- Loading indicator during verification

**Callback Flow:**
1. User completes hCaptcha challenge
2. `onCaptchaSuccess(token)` callback triggered
3. Form populated with token and `rd` parameter
4. Form submitted via POST to `/captcha/verify`
5. Browser follows redirect (ensures cookie is set properly)

## Verification Process

### Source: `src/controllers/captchaController.js`

**Route:** `POST /captcha/verify`

**Request Body:**
- `h-captcha-response` - Token from hCaptcha widget
- `rd` - Redirect destination URL

**Process:**

1. **Extract Parameters:**
   ```javascript
   const { 'h-captcha-response': hCaptchaResponse, rd } = request.body;
   const ip = request.headers['x-real-IP'] || request.ip;
   const userAgent = request.headers['user-agent'] || '';
   ```

2. **Verify with hCaptcha API:**
   ```javascript
   POST https://hcaptcha.com/siteverify
   Body: secret=HCAPTCHA_SECRET&response=TOKEN&remoteip=IP
   ```

3. **On Success:**
   - Add IP to Redis whitelist SET (`captcha_whitelist`)
   - Create secure cookie with IP and User-Agent hash
   - Set cookie via `reply.setCookie()` and `Set-Cookie` header
   - Redirect to validated `rd` URL

**Redis Whitelist Addition:**
- IP is added to Redis SET using `SADD` command
- Uses shared Redis client from `src/common/helpers/redisClient.js`
- Errors are logged but don't fail verification
- IP will be included in next daily whitelist map update

4. **On Failure:**
   - Redirect back to `/challenge?rd=...&error=verification_failed`

**Cookie Creation:**
- Name: `hc_ok`
- Contains: Version, expiration, hashed IP, hashed User-Agent
- Signed with HMAC-SHA256
- Options: `HttpOnly`, `Secure`, `SameSite: Lax`, `Path: /`, `MaxAge: 28800` (8 hours)

## Cookie Validation

### Source: `src/controllers/captchaController.js` and `src/common/helpers/captchaCookie.js`

**Route:** `GET/POST /_captcha_check`

**Process:**

1. **Check if Bot IP:**
   ```javascript
   if (isBotIp !== '1') {
     return reply.code(204).send(); // Not bot IP, allow access
   }
   ```

2. **Extract Cookie:**
   ```javascript
   const cookieValue = extractCookie(cookieHeader);
   if (!cookieValue) {
     return reply.code(401).send(); // No cookie, require challenge
   }
   ```

3. **Validate Cookie:**
   - Verify HMAC signature
   - Check expiration time
   - Verify IP hash matches current IP
   - Verify User-Agent hash matches current User-Agent

4. **Response:**
   - `204` - Cookie valid, allow access
   - `401` - Cookie invalid/missing, require challenge

**Validation Reasons:**
- `no_cookie` - Cookie not present
- `invalid_format` - Cookie format incorrect
- `invalid_signature` - HMAC signature mismatch
- `invalid_payload` - Payload cannot be decoded
- `expired` - Cookie expiration time passed
- `ip_mismatch` - IP hash doesn't match current IP
- `ua_mismatch` - User-Agent hash doesn't match current User-Agent

## Cookie Security

### Structure

Cookie value format: `{payload}.{signature}`

**Payload (Base64URL encoded JSON):**
```json
{
  "v": 1,
  "exp": 1769553322,
  "ip": "hashed_ip_address",
  "ua": "hashed_user_agent"
}
```

**Security Features:**

1. **HMAC Signature:** Prevents tampering
   - Uses `HCAPTCHA_COOKIE_SECRET` for signing
   - SHA-256 HMAC

2. **IP Binding:** Cookie tied to specific IP
   - IP hashed with pepper (`HCAPTCHA_PEPPER` or `HCAPTCHA_COOKIE_SECRET`)
   - SHA-256 hash

3. **User-Agent Binding:** Cookie tied to specific browser
   - User-Agent hashed with pepper
   - SHA-256 hash

4. **Expiration:** Cookie expires after 8 hours (configurable)

5. **HTTP-Only:** Prevents JavaScript access
6. **Secure:** Only sent over HTTPS
7. **SameSite: Lax:** CSRF protection

## Environment Variables

### Required

- `HCAPTCHA_SITE_KEY` - hCaptcha site key for frontend widget
- `HCAPTCHA_SECRET` - hCaptcha secret key for API verification
- `HCAPTCHA_COOKIE_SECRET` - Secret for signing cookies

### Optional

- `HCAPTCHA_PEPPER` - Pepper for hashing IP/UA (defaults to `HCAPTCHA_COOKIE_SECRET`)
- `NODE_PORT` - Backend server port (default: `10020`)
- `REDIS_HOST` - Redis host for bot IPs and whitelist (default: `localhost`)
- `REDIS_PORT` - Redis port (default: `6379`)
- `REDIS_DB` - Redis database (default: `11`)
- `REDIS_PASSWORD` - Redis password
- `REDIS_BOT_IPS_KEY` - Redis key for bot IPs (default: `api_bot_detection`)
- `BOT_IPS_MAP_PATH` - Path for nginx bot_ips.map file (default: `/etc/nginx/maps/bot_ips.map`)
- `BOT_IPS_UPDATE_INTERVAL` - Cron schedule (default: `*/10 * * * *`)
- `REDIS_WHITELIST_KEY` - Redis key for verified IP whitelist (default: `captcha_whitelist`)
- `WHITELIST_MAP_PATH` - Path for nginx whitelist.map file (default: `/etc/nginx/maps/whitelist.map`)
- `WHITELIST_MAP_MAX_LINES` - Maximum IPs in whitelist map (default: `200000`)
- `WHITELIST_UPDATE_INTERVAL` - Cron schedule for whitelist update (default: `0 3 * * *`)

## Rate Limiting

**Route:** `POST /captcha/verify`

- Max: 10 requests per minute per IP
- Prevents abuse of verification endpoint

## Error Handling

### Verification Failures

1. **Missing Token:**
   - Status: `400`
   - Response: `{ error: 'Missing h-captcha-response' }`

2. **hCaptcha API Error:**
   - Status: `302`
   - Redirect: `/challenge?rd=...&error=server_error`

3. **Verification Failed:**
   - Status: `302`
   - Redirect: `/challenge?rd=...&error=verification_failed`

### Cookie Validation Failures

All failures return `401` status, triggering nginx redirect to challenge page.

## Testing

### Manual Testing

1. **Test Bot IP Detection:**
   - Add test IP to Redis: `SADD api_bot_detection "1.2.3.4"`
   - Wait for job to update map file (max 10 minutes)
   - Access site from that IP
   - Should see challenge page

2. **Test Whitelist:**
   - Complete challenge from bot IP
   - Verify IP added to Redis: `SMEMBERS captcha_whitelist`
   - Wait for daily job or manually trigger whitelist update
   - Check `/etc/nginx/maps/whitelist.map` contains IP
   - Access site again - should bypass challenge (no cookie needed)
   - Verify IP removed from Redis after job runs

3. **Test Cookie Validation:**
   - Complete challenge
   - Check cookie `hc_ok` is set
   - Verify cookie persists across requests
   - Test IP mismatch (change IP, cookie should be invalid)

4. **Test Error Handling:**
   - Submit invalid token
   - Should redirect to challenge with error message

5. **Test Whitelist Precedence:**
   - Add IP to both bot list and whitelist
   - IP should be treated as whitelisted (no challenge)

## Docker Configuration

### Maps Directory Structure

All nginx map files are stored in `/etc/nginx/maps/` directory:

```
/etc/nginx/maps/
├── whitelist.map          # Verified IPs (generated daily)
├── bot_ips.map            # Bot IPs (generated every 10 minutes)
└── bot_ips_overflow.map   # Overflow bot IPs (if >200k entries)
```

**Docker Volumes:**
- Maps directory mounted as: `./nginx/{production,staging}/maps:/etc/nginx/maps`
- Single volume mount instead of individual file mounts
- Ensures all map files are in same location

**Dockerfile:**
- Creates `/etc/nginx/maps` directory during build
- Ensures directory exists before nginx starts

## Troubleshooting

### Cookie Not Setting

- Check `proxy_pass_header Set-Cookie` in nginx config
- Verify cookie options (Secure requires HTTPS)
- Check browser console for cookie-related errors

### Challenge Not Appearing

- Verify `HCAPTCHA_SITE_KEY` is set
- Check nginx `geo $is_bot_ip` configuration
- Verify bot IP is in `/etc/nginx/maps/bot_ips.map`
- Check if IP is whitelisted in `/etc/nginx/maps/whitelist.map` (whitelist takes precedence)

### Whitelist Not Working

- Verify Redis connection is working
- Check if IP was added to Redis SET `captcha_whitelist` after verification
- Wait for daily job to run (03:00) or check job logs
- Verify `/etc/nginx/maps/whitelist.map` file exists and contains IP
- Check nginx config includes whitelist.map before bot_ips.map
- Verify whitelist.map file format: `IP 0;` (not `IP 1;`)

### Verification Always Fails

- Check `HCAPTCHA_SECRET` matches site key
- Verify hCaptcha API is accessible
- Check server logs for hCaptcha API errors

### Cookie Not Validating

- Verify `HCAPTCHA_COOKIE_SECRET` is set and consistent
- Check IP/User-Agent hasn't changed
- Verify cookie expiration hasn't passed
- Check cookie format matches expected structure
