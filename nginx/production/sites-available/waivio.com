server {
    server_name         .waivio.com;
    listen              80;
    listen              [::]:80;
    listen              443 ssl http2;
    listen              [::]:443 ssl http2;
    ssl_certificate     /etc/letsencrypt/live/waivio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/waivio.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    include             /etc/nginx/snippets/waivio-server.conf;
    include             /etc/nginx/snippets/waivio-specific.conf;
}