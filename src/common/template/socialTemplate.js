const template = ({ hostName }) => `
server {
        server_name ${hostName};
        include /etc/nginx/snippets/waivio-server.conf;
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
