FROM node:24.22.1-alpine3.24

# Node 24.22.1 is the base image. Alpine 3.14's nodejs package is 14.x and
# cannot run this binary. Certbot comes from apk: pip on Alpine 3.24 is
# externally managed, and the old rust build does not apply.
RUN apk add --no-cache nginx supervisor certbot certbot-nginx certbot-dns-cloudflare \
 && node -v | grep -qx 'v24.22.1'

# Copy the main Nginx configuration
COPY ./nginx/production/nginx.conf /etc/nginx/nginx.conf

# Copy server configurations to sites-available
COPY ./nginx/production/sites-available/* /etc/nginx/sites-available/

COPY ./nginx/production/http.d/* /etc/nginx/http.d/

# Create directory for enabled sites, snippets, and maps
RUN mkdir /etc/nginx/sites-enabled/ && mkdir /etc/nginx/snippets && mkdir -p /etc/nginx/maps

# Create symlinks for enabled sites
RUN ln -s /etc/nginx/sites-available/* /etc/nginx/sites-enabled/


# Create application directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy application files
COPY package.json ./
RUN npm install
COPY . .

# Configure supervisord.
# Alpine 3.24's default config includes /etc/supervisor.d/*.ini, not conf.d.
# This file is a full config, so point supervisord at it directly.
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Start supervisord which will manage both Nginx and Node.js
CMD ["supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
