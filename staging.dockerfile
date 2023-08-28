FROM alpine:3.14.2

# Install necessary packages
RUN apk update && \
    apk add --update nodejs npm nginx supervisor

# Install certbot
RUN apk add python3 python3-dev py3-pip build-base libressl-dev musl-dev libffi-dev rust cargo
RUN pip3 install pip --upgrade
RUN pip3 install certbot-nginx
RUN mkdir /etc/letsencrypt


# Copy the main Nginx configuration
COPY ./nginx/staging/newconfig /etc/nginx/nginx.conf

# Copy server configurations to sites-available
COPY ./nginx/staging/sites-available/* /etc/nginx/sites-available/

# Create directory for enabled sites
RUN mkdir /etc/nginx/sites-enabled/

# Create symlinks for enabled sites
RUN ln -s /etc/nginx/sites-available/* /etc/nginx/sites-enabled/


# Create application directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Copy application files
COPY package.json ./
RUN npm install
COPY . .

# Expose ports
#EXPOSE 80
#EXPOSE 443
#EXPOSE 10020

# Configure supervisord
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Start supervisord which will manage both Nginx and Node.js
CMD ["supervisord", "-n"]
