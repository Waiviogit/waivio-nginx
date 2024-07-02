const template = ({ hostName }) => `
server {
        server_name ${hostName};

        location / {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_set_header X-NginX-Proxy true;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.FRONT_END_PROXY || 'http://127.0.0.1:8040'};
                proxy_redirect off;
        }

        location /api {
                proxy_pass ${process.env.API_PROXY || 'http://127.0.0.1:10000'};
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_cache_bypass $http_upgrade;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_set_header X-Forwarded-Ssl on;
                proxy_set_header X-Forwarded-Port $server_port;
                proxy_set_header X-Forwarded-Host $host;
        }

        location /campaigns-api {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host2 $http_origin;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.CAMPAIGNS_PROXY || 'http://127.0.0.1:8099'};
        }

        location /auth {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.AUTH_PROXY || 'http://127.0.0.1:8004'};
        }

        location /currencies-api {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.CURRENCY_PROXY || 'http://127.0.0.1:8001'};
        }

        location /notifications-api {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.NOTIFICATIONS_PROXY || 'http://127.0.0.1:8084'};
        }

        location /objects-bot {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.OBJECTS_BOT_PROXY || 'http://127.0.0.1:8083'};
        }

        location /campaigns-v2 {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host2 $http_origin;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.CAMPAIGNS2_PROXY || 'http://127.0.0.1:8075'};
                #proxy_redirect off;
        }

        location /arbitrage {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host2 $http_origin;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass ${process.env.ARBITRAGE_PROXY || 'http://127.0.0.1:8076'};
                #proxy_redirect off;
        }

}

server {
    if ($host = www.${hostName}) {
        return 301 https://www.${hostName}$request_uri;
    }

        server_name ${hostName};
        listen 80;
        listen [::]:80;
        return 301 https://$host$request_uri;
}
`;

module.exports = template;
