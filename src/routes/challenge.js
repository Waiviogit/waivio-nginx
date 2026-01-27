const fs = require('fs').promises;
const path = require('path');

const CHALLENGE_HTML_PATH = path.join(__dirname, '../../public/challenge.html');

async function routes(fastify, options) {
  let challengeHtml = null;

  // Загрузить HTML при старте и заменить placeholder на site key
  try {
    challengeHtml = await fs.readFile(CHALLENGE_HTML_PATH, 'utf8');
    const siteKey = process.env.HCAPTCHA_SITE_KEY || '';
    challengeHtml = challengeHtml.replace(/HCAPTCHA_SITE_KEY/g, siteKey);
  } catch (error) {
    fastify.log.warn('challenge.html not found, using default');
    challengeHtml = getDefaultChallengeHtml();
  }

  fastify.route({
    method: 'GET',
    url: '/challenge',
    handler: async (request, reply) => {
      reply.type('text/html');
      return challengeHtml;
    },
  });
}

function getDefaultChallengeHtml() {
  const siteKey = process.env.HCAPTCHA_SITE_KEY || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Required</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            max-width: 400px;
            width: 90%;
            text-align: center;
        }
        h1 {
            margin-top: 0;
            color: #333;
        }
        .error {
            color: #d32f2f;
            margin-bottom: 1rem;
            font-size: 0.9rem;
        }
        #hcaptcha-container {
            display: flex;
            justify-content: center;
            margin: 1.5rem 0;
        }
        .loading {
            color: #666;
            margin-top: 1rem;
        }
    </style>
    <script>
        window.onCaptchaSuccess = function(token) {
            const urlParams = new URLSearchParams(window.location.search);
            const rd = urlParams.get('rd') || '/';
            
            const loadingEl = document.getElementById('loading');
            if (loadingEl) {
                loadingEl.style.display = 'block';
            }
            
            const form = document.getElementById('verify-form');
            const tokenInput = document.getElementById('captcha-token');
            const rdInput = document.getElementById('redirect-param');
            
            if (form && tokenInput && rdInput) {
                tokenInput.value = token;
                rdInput.value = rd;
                form.submit();
            }
        };
    </script>
    <script src="https://js.hcaptcha.com/1/api.js" async defer></script>
</head>
<body>
    <div class="container">
        <h1>Verification Required</h1>
        <p>Please complete the verification below to continue.</p>
        <div id="error-message" class="error"></div>
        <div id="hcaptcha-container">
            <div class="h-captcha" 
                 data-sitekey="${siteKey}" 
                 data-callback="onCaptchaSuccess"
                 data-size="normal"
                 data-theme="light"></div>
        </div>
        <div id="loading" class="loading" style="display: none;">Verifying...</div>
        <form id="verify-form" method="POST" action="/captcha/verify" style="display: none;">
            <input type="hidden" name="h-captcha-response" id="captcha-token">
            <input type="hidden" name="rd" id="redirect-param">
        </form>
    </div>
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        
        if (error) {
            document.getElementById('error-message').textContent = 
                error === 'verification_failed' ? 'Verification failed. Please try again.' :
                error === 'server_error' ? 'Server error. Please try again later.' :
                'An error occurred. Please try again.';
        }
    </script>
</body>
</html>`;
}

module.exports = routes;
