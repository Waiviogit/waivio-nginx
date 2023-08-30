const util = require('util');
const { SITE_AVAILABLE_PATH, SITE_ENABLED_PATH } = require('../constants/path');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs').promises;
const path = require('path');

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

const generateCertificate = async ({ host }) => {
  try {
    const result = await exec(`certbot --nginx --non-interactive --agree-tos --email ${process.env.CERTBOT_EMAIL} -d ${host}`);
    return { result };
  } catch (error) {
    return { error };
  }
};

const removeConfiguration = async ({ host }) => {
  try {
    await exec(`rm ${path.join(SITE_AVAILABLE_PATH, host)}`);
    await exec(`rm ${path.join(SITE_ENABLED_PATH, host)}`);
    return { result: true };
  } catch (error) {
    return { error };
  }
};

module.exports = {
  saveFile,
  createSymlink,
  reloadNginx,
  generateCertificate,
  removeConfiguration,
};
