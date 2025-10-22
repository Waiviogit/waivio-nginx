server {

	server_name .waivio.com;

	listen 80;
	listen [::]:80;
	listen 443 ssl http2;
	listen [::]:443 ssl http2;

	ssl_certificate /etc/letsencrypt/live/waivio.com/fullchain.pem;
	ssl_certificate_key /etc/letsencrypt/live/waivio.com/privkey.pem;
	include /etc/letsencrypt/options-ssl-nginx.conf;


	location /api {
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_api;
	}

	location /currencies-api {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_currencies;
	}

	location / {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_frontend;
	}

	location /notifications-api {

		proxy_http_version 1.1;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_notifications;
	}

	location /objects-bot {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_objects_bot;
	}


	location /auth {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_auth;
		#proxy_redirect off;
	}

	location /campaigns-api {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_campaigns;
		#proxy_redirect off;
	}

	location /import-objects-service {

		client_max_body_size 100M;
		proxy_http_version 1.1;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_object_import;

		proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
	}

	location /campaigns-v2 {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host2 $http_origin;
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://waivio_campaigns_2;
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
		proxy_pass http://waivio_arbitrage;
		#proxy_redirect off;
	}

	location /nginx {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host2 $http_origin;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_pass http://waivio_nginx;
        #proxy_redirect off;
    }

	location /seo-service {

    	proxy_http_version 1.1;
    	proxy_set_header X-Real-IP $remote_addr;
    	proxy_set_header Upgrade $http_upgrade;
    	proxy_set_header Connection 'upgrade';
    	proxy_set_header Host $host;
    	proxy_cache_bypass $http_upgrade;
    	proxy_pass http://127.0.0.1:11001;
    }

    location /telegram-api {

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_pass http://waivio_telegram;
    }

    location /assistant {

        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_pass http://waivio_assistant;
    }

}

