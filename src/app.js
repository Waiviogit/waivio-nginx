const fastify = require('fastify')({ logger: true });
const nginxRoutes = require('./routes/nginxConfig');
const captchaRoutes = require('./routes/captcha');
const challengeRoutes = require('./routes/challenge');
require('./jobs');

fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/rate-limit'), {
  global: false,
});

fastify.register(nginxRoutes);
fastify.register(captchaRoutes);
fastify.register(challengeRoutes);

fastify.listen({ port: process.env.NODE_PORT || 10020, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
