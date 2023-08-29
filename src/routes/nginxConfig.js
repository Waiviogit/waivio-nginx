const { configController } = require('../controllers');
const { checkKey } = require('../operations/validateRequest');

async function routes(fastify, options) {
  fastify.route({
    method: 'POST',
    url: '/nginx/add-site',
    preHandler: checkKey,
    handler: configController.addSite,
  });
}

module.exports = routes;
