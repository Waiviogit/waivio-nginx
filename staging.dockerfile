# Use the official Nginx image as the base image
# Use the official Nginx image as the base image
#FROM nginx AS nginx-stage
#
## Install Certbot and any necessary dependencies
#RUN apt-get update && \
#    apt-get install -y certbot python3-certbot-nginx && \
#    apt-get clean && \
#    rm -rf /var/lib/apt/lists/*
#
## Copy the main Nginx configuration
##COPY ./nginx/staging/nginx.conf /etc/nginx/nginx.conf
#
## Copy server configurations to sites-available
#COPY ./nginx/staging/sites-available/* /etc/nginx/sites-available/
#
## Create directory for enabled sites
#RUN mkdir /etc/nginx/sites-enabled/
#
## Create symlinks for enabled sites
#RUN ln -s /etc/nginx/sites-available/* /etc/nginx/sites-enabled/
#
## Expose ports
#EXPOSE 80
#EXPOSE 443
#
## Run Certbot to generate SSL certificates
## Remove this line in production
##RUN certbot --nginx --non-interactive --agree-tos --email your-email@example.com -d $(ls /etc/nginx/sites-available/ | sed 's/ / -d /g')
#
## Start Nginx when the container runs
#CMD ["nginx", "-g", "daemon off;"]
#
#
#FROM node:18.12.0-slim AS nodejs-stage
#
#RUN mkdir -p /usr/src/app
#WORKDIR /usr/src/app
#
#COPY ./package.json ./
#
#RUN npm install
#COPY . .
#
#EXPOSE 10020
#
#CMD ["npm", "run", "start"]


FROM alpine:3.14.2
RUN apk update
RUN apk add --update nodejs npm
RUN apk add nginx

# Copy server configurations to sites-available
COPY ./nginx/staging/sites-available/* /etc/nginx/sites-available/
# Create directory for enabled sites
RUN mkdir /etc/nginx/sites-enabled/
# Create symlinks for enabled sites
RUN ln -s /etc/nginx/sites-available/* /etc/nginx/sites-enabled/


RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY ./package.json ./

RUN npm install
COPY . .

EXPOSE 80
EXPOSE 443
EXPOSE 10020

RUN nginx

CMD ["npm", "run", "start"]
