const Joi = require('joi');

exports.addSiteSchema = Joi.object().keys({
  host: Joi.string().required(),
  generateCert: Joi.boolean().default(false),
});
