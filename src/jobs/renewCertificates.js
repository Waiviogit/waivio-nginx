const { CronJob } = require('cron');
const { renewCertificates, reloadNginx } = require('../common/helpers/nginxHelpers');

exports.renewCertificatesJob = new CronJob('00 12 */1 * *', async () => {
  await renewCertificates();
  await reloadNginx();
}, null, false, null, null, false);
