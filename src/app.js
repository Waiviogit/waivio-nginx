const fastify = require('fastify')({ logger: true });
const nginxRoutes = require('./routes/nginxConfig');

fastify.register(nginxRoutes);

fastify.listen({ port: 10020, host: '0.0.0.0' }, (err) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
