const checkKey = async (request, reply) => {
  const { headers } = request;
  if (!headers['nginx-key']) return reply.status(400).send({ error: 'No key provided' });
  const correctKey = process.env.NGINX_KEY === headers['nginx-key'];
  if (!correctKey) return reply.status(400).send({ error: 'Incorrect key' });
};

module.exports = {
  checkKey,
};
