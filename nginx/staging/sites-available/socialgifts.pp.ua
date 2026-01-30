server {
    server_name         socialgifts.pp.ua *.socialgifts.pp.ua;
    include             /etc/nginx/snippets/waivio-server.conf;
    listen              [::]:443 ssl;
    listen              443 ssl;
    ssl_certificate     /etc/nginx/certs/social.crt;
    ssl_certificate_key /etc/nginx/certs/social.key;
    ssl_protocols       TLSv1 TLSv1.1 TLSv1.2;
    ssl_ciphers         "HIGH:!RC4:!aNULL:!MD5:!kEDH";
}

server {
    if ($host = www.socialgifts.pp.ua) {
        return 301 https://www.socialgifts.pp.ua$request_uri;
    }

    server_name socialgifts.pp.ua *.socialgifts.pp.ua;
    listen      80;
    listen      [::]:80;
    return      301 https://$host$request_uri;
}