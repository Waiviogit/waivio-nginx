const crypto = require('crypto');

const COOKIE_NAME = 'hc_ok';
const COOKIE_VERSION = 1;
const DEFAULT_TTL_HOURS = 24 * 7;

const getSecret = () => {
  const secret = process.env.HCAPTCHA_COOKIE_SECRET;
  if (!secret) {
    throw new Error('HCAPTCHA_COOKIE_SECRET environment variable is required');
  }
  return secret;
};

const getPepper = () => process.env.HCAPTCHA_PEPPER || getSecret();

// Base64url encode
const base64urlEncode = (buffer) => buffer.toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

// Base64url decode
const base64urlDecode = (str) => {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  return Buffer.from(base64 + '='.repeat(padding), 'base64');
};

const hashValue = (value) => {
  const pepper = getPepper();
  return crypto.createHash('sha256').update(value + pepper).digest('hex');
};

const signPayload = (payloadB64) => {
  const secret = getSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadB64);
  return base64urlEncode(hmac.digest());
};

const createCookieValue = (payload) => {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(Buffer.from(payloadJson));
  const sig = signPayload(payloadB64);
  return `${payloadB64}.${sig}`;
};

const createCookie = (ip, userAgent, ttlHours = DEFAULT_TTL_HOURS) => {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (ttlHours * 3600);

  const payload = {
    v: COOKIE_VERSION,
    exp,
  };

  if (ip) {
    payload.ip = hashValue(ip);
  }

  if (userAgent) {
    payload.ua = hashValue(userAgent);
  }

  const cookieValue = createCookieValue(payload);
  const maxAge = ttlHours * 3600;

  return {
    name: COOKIE_NAME,
    value: cookieValue,
    options: {
      HttpOnly: true,
      Secure: true,
      SameSite: 'Lax',
      Path: '/',
      MaxAge: maxAge,
    },
  };
};

const validateCookie = (cookieValue, ip, userAgent) => {
  if (!cookieValue) {
    return { valid: false, reason: 'no_cookie' };
  }

  const parts = cookieValue.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'invalid_format' };
  }

  const [payloadB64, sigB64] = parts;

  // Проверить подпись
  const expectedSig = signPayload(payloadB64);
  if (sigB64 !== expectedSig) {
    return { valid: false, reason: 'invalid_signature' };
  }

  let payload;
  try {
    const payloadJson = base64urlDecode(payloadB64).toString('utf8');
    payload = JSON.parse(payloadJson);
  } catch (e) {
    return { valid: false, reason: 'invalid_payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    return { valid: false, reason: 'expired' };
  }

  if (ip && payload.ip) {
    const expectedIpHash = hashValue(ip);
    if (payload.ip !== expectedIpHash) {
      return { valid: false, reason: 'ip_mismatch' };
    }
  }

  if (userAgent && payload.ua) {
    const expectedUaHash = hashValue(userAgent);
    if (payload.ua !== expectedUaHash) {
      return { valid: false, reason: 'ua_mismatch' };
    }
  }

  return { valid: true, payload };
};

const extractCookie = (cookieHeader) => {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').map((c) => c.trim());
  const cookie = cookies.find((c) => c.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) {
    return null;
  }

  return cookie.substring(COOKIE_NAME.length + 1);
};

module.exports = {
  COOKIE_NAME,
  createCookie,
  validateCookie,
  extractCookie,
};
