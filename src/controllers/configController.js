const addSiteConfiguration = require('../operations/addSiteConfiguration');
const { configValidation } = require('./validation');

const addSite = async (request, reply) => {
  const validation = configValidation.addSiteSchema.validate(request.body);
  if (validation.error) return reply.status(400).send({ error: validation.error });

  const { result, error } = await addSiteConfiguration(validation.value);
  if (error) return reply.status(500).send({ error });
  reply.send({ result });
};

module.exports = {
  addSite,
};
