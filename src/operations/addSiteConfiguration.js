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
    const result = await exec('systemctl reload nginx');
    return { result };
  } catch (error) {
    return { error };
  }
};

const addSiteConfiguration = async ({
  host,
}) => {
  const template = siteTemplate(host);
  const pathToFile = path.join(SITE_AVAILABLE_PATH, host);
  const { result, error } = await saveFile({ pathToFile, file: template });
  if (error) return { error };
  const { result: symLink, error: symLinkErr } = await createSymlink({
    pathToFile, pathToSymlink: path.join(SITE_ENABLED_PATH, host),
  });
  if (symLinkErr) return { error: symLinkErr };
  const { result: reloadResult, error: reloadError } = await reloadNginx();
  if (reloadError) return { error: reloadError };
  return { result: reloadResult };
};

module.exports = addSiteConfiguration;
