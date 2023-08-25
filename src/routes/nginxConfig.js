const addSiteConfiguration = require('../operations/addSiteConfiguration');

async function routes(fastify, options) {
  fastify.route({
    method: 'GET',
    url: '/',
    handler: async (request, reply) => {
      const { result, error } = await addSiteConfiguration({ host: 'test.com' });
      if (error) return reply.status(500).send({ error });
      reply.send({ result });
    },
  });
}

module.exports = routes;
