const path = require('path');
const siteTemplate = require('../common/template/socialTemplate');
const { SITE_AVAILABLE_PATH, SITE_ENABLED_PATH } = require('../common/constants/path');
const {
  saveFile, createSymlink, generateCertificate, reloadNginx,
} = require('../common/helpers/nginxHelpers');

const addSiteConfiguration = async ({
  host, generateCert = false,
}) => {
  const template = siteTemplate({ hostName: host });
  const pathToFile = path.join(SITE_AVAILABLE_PATH, host);
  const { result, error } = await saveFile({ pathToFile, file: template });
  if (error) {
    console.log('saveFile error');
    return { error };
  }
  console.log('saveFile result', result);
  const { result: symLink, error: symLinkErr } = await createSymlink({
    pathToFile, pathToSymlink: path.join(SITE_ENABLED_PATH, '/'),
  });
  if (symLinkErr) {
    console.log('symLinkErr error');
    return { error: symLinkErr };
  }
  console.log('symLink result', symLink);
  if (generateCert) {
    const { result: certResult, error: certError } = await generateCertificate({ host });
    if (certError) {
      console.log('certError error');
      return { error: certError };
    }
    console.log('certResult result', certResult);
  }
  const { result: reloadResult, error: reloadError } = await reloadNginx();
  if (reloadError) {
    console.log('reloadError error');
    return { error: reloadError };
  }
  return { result: reloadResult };
};

module.exports = addSiteConfiguration;
