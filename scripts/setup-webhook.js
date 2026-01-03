const axios = require('axios');
const crypto = require('crypto');

// Your myPOS credentials
const CLIENT_ID = 'fvMiobLyIlwa3Qsx7Sl5TeYo';
const CLIENT_SECRET = 'd0eGKwbSkzPrqmzj4gY8tcsbgdaLkt5LODD6vto7bNCREKzW';

// Your webhook URL
const WEBHOOK_URL = 'https://gotovdoc-backend-production.up.railway.app/api/payment/webhook/mypos';

// Generate a random webhook secret
const WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');

console.log('🔧 Setting up myPOS Webhook...\n');
console.log('📝 Webhook Secret (SAVE THIS!):', WEBHOOK_SECRET);
console.log('');

async function setupWebhook() {
  try {
    // Step 1: Get OAuth Token
    console.log('Step 1: Getting OAuth token...');

    const authCredentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await axios({
      method: 'POST',
      url: 'https://auth-api.mypos.com/oauth/token',
      headers: {
        'Authorization': `Basic ${authCredentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'client_credentials'
      }).toString()
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ OAuth token obtained\n');
    console.log('Access Token:', accessToken);

    // Step 2: Create Webhook
    console.log('Step 2: Creating webhook...');

    const webhookResponse = await axios({
      method: 'POST',
      url: 'https://webhook-api.mypos.com/v1/webhooks',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        payload_url: WEBHOOK_URL,
        secret: WEBHOOK_SECRET
      }).toString()
    });

    console.log('✅ Webhook created successfully!\n');
    console.log('📊 Webhook Details:');
    console.log(JSON.stringify(webhookResponse.data, null, 2));
    console.log('\n🎉 Setup Complete!\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 ADD THESE TO YOUR RAILWAY ENVIRONMENT VARIABLES:');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`MYPOS_CLIENT_ID=${CLIENT_ID}`);
    console.log(`MYPOS_CLIENT_SECRET=${CLIENT_SECRET}`);
    console.log(`MYPOS_WEBHOOK_SECRET=${WEBHOOK_SECRET}`);
    console.log('Project_ENV=prod');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('🚀 After adding env vars, redeploy your Railway app!');
    
  } catch (error) {
    if (error.response) {
      console.error('❌ Error:', error.response.status);
      console.error('Response:', error.response.data);
      
      if (error.response.data.error === 'invalid_client') {
        console.log('\n⚠️  Your credentials need activation!');
        console.log('📧 Contact myPOS support: support@mypos.com');
        console.log('📋 Request: "Please activate my REST API credentials"');
        console.log('📋 Provide Client ID:', CLIENT_ID);
      }
    } else {
      console.error('❌ Error:', error.message);
    }
  }
}

setupWebhook();

