.staging.env example

FRONT_END_PROXY=http://example:3000
API_PROXY=http://example:3000
CAMPAIGNS_PROXY=http://example:3000
CAMPAIGNS2_PROXY=http://example:3000
AUTH_PROXY=http://example:3000
CURRENCY_PROXY=http://example:3000
NOTIFICATIONS_PROXY=http://example:3000
OBJECTS_BOT_PROXY=http://example:3000
ARBITRAGE_PROXY=http://example:3000

NGINX_PORT1=80
NGINX_PORT2=443

NODE_PORT=4444

EXTERNAL_HOST=example
EXTERNAL_IP=0.0.0.0
CERTBOT_EMAIL=example@mail.com


## ENABLE LOG ROTATION 

```sudo nano /etc/logrotate.d/nginx-proxy```

paste

```
/home/path/to/logs/*.log  {
    daily
    missingok
    rotate 7
    maxage 7
    compress
    delaycompress
    notifempty
    sharedscripts
    copytruncate
}
```

test

```sudo logrotate -f /etc/logrotate.d/nginx-proxy```
