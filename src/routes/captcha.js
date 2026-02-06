const { captchaController } = require('../controllers');

async function routes(fastify, options) {
  fastify.route({
    method: ['GET', 'POST'],
    url: '/_captcha_check',
    logLevel: 'silent',
    handler: captchaController.checkCaptcha,
  });

  fastify.route({
    method: 'POST',
    url: '/captcha/verify',
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
      },
    },
    handler: captchaController.verifyCaptcha,
  });
}

module.exports = routes;
