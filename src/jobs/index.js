const { renewCertificatesJob } = require('./renewCertificates');
const { updateBotIpsJob } = require('./updateBotIps');
const { updateWhitelistJob } = require('./updateWhitelist');

renewCertificatesJob.start();
updateBotIpsJob.start();
updateWhitelistJob.start();
