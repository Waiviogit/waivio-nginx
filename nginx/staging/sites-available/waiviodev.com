server {

        server_name waiviodev.com www.waiviodev.com;

        location /api {
                proxy_pass http://127.0.0.1:10000;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_cache_bypass $http_upgrade;
                proxy_set_header  X-Forwarded-Proto $scheme;
                proxy_set_header  X-Forwarded-Ssl on;
                proxy_set_header  X-Forwarded-Port $server_port;
                proxy_set_header  X-Forwarded-Host $host;
        }

        location / {
                proxy_set_header Origin $http_origin;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://127.0.0.1:8040;
        }


        location /notifications-api {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://127.0.0.1:8084;
        }

        location /telegram-api {
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://127.0.0.1:4000;
       }

       location /currencies-api {
                proxy_http_version 1.1;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
                proxy_pass http://127.0.0.1:8001;
      }

      location /waivio-parser {
               proxy_http_version 1.1;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header Upgrade $http_upgrade;
               proxy_set_header Connection 'upgrade';
               proxy_set_header Host $host;
               proxy_cache_bypass $http_upgrade;
               proxy_pass http://127.0.0.1:8082;
      }

      location /objects-bot {
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header X-Real-IP $remote_addr;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_cache_bypass $http_upgrade;
              proxy_pass http://127.0.0.1:8083;
      }

      location /campaigns-api {
              proxy_read_timeout 300;
              proxy_connect_timeout 300;
              proxy_send_timeout 300;
              proxy_http_version 1.1;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header X-Real-IP $remote_addr;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host2 $http_origin;
              proxy_set_header Host $host;
              proxy_cache_bypass $http_upgrade;
              proxy_pass http://127.0.0.1:8099;
              #proxy_redirect off;
      }

      location /auth {
              proxy_http_version 1.1;
              proxy_set_header X-Real-IP $remote_addr;
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection 'upgrade';
              proxy_set_header Host $host;
              proxy_cache_bypass $http_upgrade;
              proxy_pass http://127.0.0.1:8004;
              #proxy_redirect off;
      }

      location /campaigns-v2 {
               proxy_http_version 1.1;
               proxy_set_header Upgrade $http_upgrade;
               proxy_set_header X-Real-IP $remote_addr;
               proxy_set_header Connection 'upgrade';
               proxy_set_header Host2 $http_origin;
               proxy_set_header Host $host;
               proxy_cache_bypass $http_upgrade;
               proxy_pass http://127.0.0.1:8075;
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
               proxy_pass http://127.0.0.1:8076;
               #proxy_redirect off;
      }

      listen 443 ssl; # managed by Certbot
      ssl_certificate /etc/letsencrypt/live/waiviodev.com-0001/fullchain.pem; # managed by Certbot
      ssl_certificate_key /etc/letsencrypt/live/waiviodev.com-0001/privkey.pem; # managed by Certbot
      include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
      ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}

server {
    if ($host = www.waiviodev.com) {
       return 301 https://$host$request_uri;
    } # managed by Certbot


    if ($host = waiviodev.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


        listen 80;
        listen [::]:80;

        server_name waiviodev.com www.waiviodev.com;
   return 404;

}




