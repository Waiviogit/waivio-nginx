server {
        server_name dinings.pp.ua *.dinings.pp.ua;

        location / {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_set_header X-NginX-Proxy true;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_frontend;
                proxy_redirect off;
        }

        location /api {
                proxy_pass http://waivio_api;
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
                proxy_pass http://waivio_campaigns;
        }

        location /auth {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_auth;
        }

        location /currencies-api {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_currencies;
        }

        location /notifications-api {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_notifications;
        }

        location /objects-bot {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_objects_bot;
        }

        location /campaigns-v2 {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host2 $http_origin;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_campaigns_2;
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
                proxy_pass http://waivio_arbitrage;
                #proxy_redirect off;
        }

        location /assistant {

                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://waivio_assistant;
        }

        listen [::]:443 ssl;
        listen 443 ssl;

        ssl_certificate /etc/nginx/certs/dinings.crt;
        ssl_certificate_key /etc/nginx/certs/dinings.key;
        ssl_protocols TLSv1 TLSv1.1 TLSv1.2;
        ssl_ciphers "HIGH:!RC4:!aNULL:!MD5:!kEDH";
}

server {
    if ($host = www.dinings.pp.ua) {
        return 301 https://www.dinings.pp.ua$request_uri;
    }

        server_name dinings.pp.ua *.dinings.pp.ua;
        listen 80;
        listen [::]:80;
        return 301 https://$host$request_uri;
}

