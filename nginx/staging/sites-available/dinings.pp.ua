server {
        server_name dinings.pp.ua *.dinings.pp.ua;
        include /etc/nginx/snippets/waivio-server.conf;

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

