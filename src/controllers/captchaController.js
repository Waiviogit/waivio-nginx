const axios = require('axios');
const { isbot } = require('isbot');
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
      return reply.redirect(`/challenge?rd=${encodeURIComponent(redirectUrl)}&error=verification_failed`);
    }

    const cookie = createCookie(ip, userAgent);
    const redirectUrl = validateRedirectUrl(rd, host);

    request.log.info({
      event: 'challenge_passed',
      ip,
    });

    reply.setCookie(cookie.name, cookie.value, cookie.options);

    // Also set via header directly as fallback to ensure cookie is set
    const cookieString = `${cookie.name}=${cookie.value}; Path=${cookie.options.Path}; Max-Age=${cookie.options.MaxAge}; HttpOnly; Secure; SameSite=${cookie.options.SameSite}`;
    reply.header('Set-Cookie', cookieString);

    return reply.redirect(redirectUrl);
  } catch (error) {
    request.log.error({
      event: 'hcaptcha_api_error',
      error: error.message,
      ip,
    });

    const redirectUrl = validateRedirectUrl(rd, host);
    return reply.redirect(`/challenge?rd=${encodeURIComponent(redirectUrl)}&error=server_error`);
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

  const botUa = isbot(userAgent);
  if (botUa) {
    return reply.code(204).send();
  }

  const cookieValue = extractCookie(cookieHeader);

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
    });
    return reply.code(401).send();
  }

  return reply.code(204).send();
};

module.exports = {
  verifyCaptcha,
  checkCaptcha,
};
