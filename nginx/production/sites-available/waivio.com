server {

	server_name .waivio.com;

	listen 80;
	listen [::]:80;
	#listen 443 ssl http2;
	#listen [::]:443 ssl http2;

	#ssl_certificate /etc/letsencrypt/live/waivio.com/fullchain.pem;
	#ssl_certificate_key /etc/letsencrypt/live/waivio.com/privkey.pem;
	#include /etc/letsencrypt/options-ssl-nginx.conf;


	location /api {

		client_max_body_size 15M;
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
		proxy_pass http://127.0.0.1:8001;
	}
	location /email-api {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8100;
	}

	location / {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8040;
	}

	location /notifications-api {

		proxy_http_version 1.1;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8084;
	}

	location /objects-bot {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8083;
	}


	location /auth {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8004;
		#proxy_redirect off;
	}

	location /campaigns-api {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8099;
		#proxy_redirect off;
	}

	location /admin-api {

		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8003;
		#proxy_redirect off;
	}

	location /import-objects-service {

		client_max_body_size 50M;
		proxy_http_version 1.1;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection 'upgrade';
		proxy_set_header Host $host;
		proxy_cache_bypass $http_upgrade;
		proxy_pass http://127.0.0.1:8085;
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

	location /nginx {
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host2 $http_origin;
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_pass http://127.0.0.1:11090;
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


}

