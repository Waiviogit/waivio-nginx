const { configController } = require('../controllers');

async function routes(fastify, options) {
  fastify.route({
    method: 'POST',
    url: '/add-site',
    handler: configController.addSite,
  });
}

module.exports = routes;
