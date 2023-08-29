server {
        server_name dinings.pp.ua *.dinings.pp.ua;
        access_log /var/log/nginx/$host.log;

        location / {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_set_header X-NginX-Proxy true;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://localnode:8040;
                proxy_redirect off;
        }

        location /api {
                proxy_pass http://127.0.0.1:10000;
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
                proxy_pass http://localnode:8099;
        }

        location /auth {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://localnode:8004;
        }

        location /currencies-api {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://localnode:8001;
        }

        location /notifications-api {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://localnode:8084;
        }

        location /objects-bot {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://localnode:8083;
        }

        location /campaigns-v2 {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host2 $http_origin;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://localnode:8075;
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
                proxy_pass http://localnode:8076;
                #proxy_redirect off;
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

