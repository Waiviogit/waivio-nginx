const siteTemplate = require('../common/template/socialTemplate');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const SITE_AVAILABLE_PATH = '/etc/nginx/sites-available';
const SITE_ENABLED_PATH = '/etc/nginx/sites-enabled';

const saveFile = async ({ pathToFile, file }) => {
  try {
    const result = await fs.writeFile(pathToFile, file);
    return { result };
  } catch (error) {
    return { error };
  }
};

const createSymlink = async ({ pathToFile, pathToSymlink }) => {
  try {
    const result = await exec(`ln -s ${pathToFile} ${pathToSymlink}`);
    return { result };
  } catch (error) {
    return { error };
  }
};

const reloadNginx = async () => {
  try {
    const result = await exec('nginx -s reload');
    return { result };
  } catch (error) {
    return { error };
  }
};

//todo chage email
const generateCertificate = async ({ host }) => {
  try {
    const result = await exec(`certbot --nginx --non-interactive --agree-tos --email sifob96035@wlmycn.com -d ${host}`);
    return { result };
  } catch (error) {
    return { error };
  }
};

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
