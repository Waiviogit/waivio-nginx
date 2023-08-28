server {
        server_name socialgifts.pp.ua *.socialgifts.pp.ua;
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
                proxy_pass http://localnode:10000;
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

}

server {
    if ($host = www.socialgifts.pp.ua) {
        return 301 https://www.socialgifts.pp.ua$request_uri;
    }

        server_name socialgifts.pp.ua *.socialgifts.pp.ua;
        listen 80;
        listen [::]:80;
        return 301 https://$host$request_uri;
}


