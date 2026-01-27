const axios = require('axios');
const { createCookie, validateCookie, extractCookie } = require('../common/helpers/captchaCookie');

const { HCAPTCHA_SECRET } = process.env;
const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';

// Валидировать URL для редиректа (защита от open redirect)
const validateRedirectUrl = (url, host) => {
  if (!url) {
    return '/';
  }

  try {
    const urlObj = new URL(url, `https://${host}`);

    if (urlObj.hostname !== host && urlObj.hostname !== `www.${host}`) {
      return '/';
    }

    if (url.startsWith('/')) {
      return url;
    }

    if (urlObj.hostname === host || urlObj.hostname === `www.${host}`) {
      return urlObj.pathname + urlObj.search;
    }

    return '/';
  } catch (e) {
    return '/';
  }
};

const verifyCaptcha = async (request, reply) => {
  const { 'h-captcha-response': hCaptchaResponse, rd } = request.body;
  const ip = request.headers['x-real-ip'] || request.ip;
  const userAgent = request.headers['user-agent'] || '';
  const host = request.headers.host || '';

  request.log.debug({
    event: 'verify_captcha_request',
    body: request.body,
    hasResponse: !!hCaptchaResponse,
    contentType: request.headers['content-type'],
  });

  if (!hCaptchaResponse) {
    request.log.warn({
      event: 'missing_captcha_response',
      body: request.body,
      headers: request.headers,
    });
    return reply.code(400).send({
      error: 'Missing h-captcha-response',
    });
  }

  if (!HCAPTCHA_SECRET) {
    request.log.error('HCAPTCHA_SECRET not configured');
    return reply.code(500).send({
      error: 'Server configuration error',
    });
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', HCAPTCHA_SECRET);
    formData.append('response', hCaptchaResponse);
    if (ip) {
      formData.append('remoteip', ip);
    }

    request.log.debug({
      event: 'hcaptcha_verify_request',
      ip,
      hasSecret: !!HCAPTCHA_SECRET,
      hasResponse: !!hCaptchaResponse,
      responseLength: hCaptchaResponse ? hCaptchaResponse.length : 0,
    });

    const verifyResponse = await axios.post(HCAPTCHA_VERIFY_URL, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 5000,
    });

    const { success, 'error-codes': errorCodes } = verifyResponse.data;

    if (!success) {
      request.log.warn({
        event: 'challenge_failed',
        ip,
        errors: errorCodes,
      });

      const redirectUrl = validateRedirectUrl(rd, host);
      return reply.redirect(302, `/challenge?rd=${encodeURIComponent(redirectUrl)}&error=verification_failed`);
    }

    const cookie = createCookie(ip, userAgent);
    const redirectUrl = validateRedirectUrl(rd, host);

    request.log.info({
      event: 'challenge_passed',
      ip,
      userAgent,
      cookieName: cookie.name,
      cookieValue: cookie.value.substring(0, 50) + '...',
      cookieOptions: cookie.options,
      redirectUrl,
      host,
    });

    // Set cookie before redirect - ensure it's set properly
    try {
      reply.setCookie(cookie.name, cookie.value, cookie.options);
      
      // Also set via header directly to ensure it's sent
      const cookieString = `${cookie.name}=${cookie.value}; Path=${cookie.options.Path}; Max-Age=${cookie.options.MaxAge}; HttpOnly; Secure; SameSite=${cookie.options.SameSite}`;
      reply.header('Set-Cookie', cookieString);
      
      request.log.debug({
        event: 'cookie_set',
        cookieName: cookie.name,
        cookieValue: cookie.value.substring(0, 30) + '...',
        options: cookie.options,
        cookieString: cookieString.substring(0, 50) + '...',
      });
    } catch (cookieError) {
      request.log.error({
        event: 'cookie_set_error',
        error: cookieError.message,
      });
    }
    
    return reply.redirect(302, redirectUrl);
  } catch (error) {
    request.log.error({
      event: 'hcaptcha_api_error',
      error: error.message,
      ip,
    });

    const redirectUrl = validateRedirectUrl(rd, host);
    return reply.redirect(302, `/challenge?rd=${encodeURIComponent(redirectUrl)}&error=server_error`);
  }
};

// GET/POST /_captcha_check
const checkCaptcha = async (request, reply) => {
  const isBotIp = request.headers['x-is-bot-ip'];
  const ip = request.headers['x-real-ip'] || request.ip;
  const userAgent = request.headers['user-agent'] || '';
  const cookieHeader = request.headers.cookie || '';

  if (isBotIp !== '1') {
    return reply.code(204).send();
  }

  const cookieValue = extractCookie(cookieHeader);

  request.log.debug({
    event: 'captcha_check',
    ip,
    hasCookie: !!cookieValue,
    cookieHeader: cookieHeader ? cookieHeader.substring(0, 100) : '',
    isBotIp,
  });

  if (!cookieValue) {
    request.log.info({
      event: 'challenge_required',
      ip,
      reason: 'no_cookie',
    });
    return reply.code(401).send();
  }

  const validation = validateCookie(cookieValue, ip, userAgent);

  if (!validation.valid) {
    request.log.info({
      event: 'challenge_required',
      ip,
      reason: validation.reason,
      userAgent,
    });
    return reply.code(401).send();
  }

  request.log.debug({
    event: 'bot_ip_allowed',
    ip,
  });

  return reply.code(204).send();
};

module.exports = {
  verifyCaptcha,
  checkCaptcha,
};
