const {
  reloadNginx, removeConfiguration,
} = require('../common/helpers/nginxHelpers');

const removeSiteConfiguration = async ({ host }) => {
  const { result: removeResult, error: removeError } = await removeConfiguration({ host });
  if (removeError) {
    console.log('removeError error');
    return { error: removeError };
  }
  await reloadNginx();
  return { result: removeResult };
};

module.exports = removeSiteConfiguration;
