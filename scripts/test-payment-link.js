const axios = require('axios');

// ============================================
// SANDBOX/TEST CREDENTIALS
// ============================================
// IMPORTANT: Sandbox requires SEPARATE test credentials!
// Get them from: https://www.mypos.com → Account → API Credentials → Generate Test Credentials
// ============================================

// SANDBOX TEST CREDENTIALS
const CLIENT_ID = process.env.MYPOS_TEST_CLIENT_ID || 'fvMiobLyIlwa3Qsx7Sl5TeYo';
const CLIENT_SECRET = process.env.MYPOS_TEST_CLIENT_SECRET || 'd0eGKwbSkzPrqmzj4gY8tcsbgdaLkt5LODD6vto7bNCREKzW';

// API Key is the same as Client ID
const API_KEY = CLIENT_ID;

console.log('🔧 Testing myPOS Payment Link Creation (SANDBOX)...\n');

// Credentials are set, proceed with test

async function testPaymentLink() {
  try {
    // Step 1: Get OAuth Token
    console.log('Step 1: Getting OAuth token...');

    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await axios({
      method: 'POST',
      url: 'https://auth-api.mypos.com/oauth/token',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams({
        grant_type: 'client_credentials'
      }).toString()
    });

    const accessToken = tokenResponse.data.access_token;
    console.log('✅ OAuth token obtained');
    console.log('Access Token:', accessToken);
    console.log('');

    // Step 2: Create Payment Link (API v1.1)
    console.log('Step 2: Creating payment link...');
    console.log('Using endpoint: https://transactions-api.mypos.com/v1.1/online-payments/link');
    console.log('');

    // Generate UUID-like request ID
    const generateRequestId = () => {
      const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    };
    
    const requestId = generateRequestId();
    
    // Request body format as per myPOS documentation
    // Note: expired_date is optional but might be required in sandbox
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30); // 30 days from now
    const expiredDate = futureDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    const requestBody = {
      item_name: 'Example Item',
      item_price: 3.43,
      pref_language: 'BG',
      currency: 'GBP',
      account_number: '',
      custom_name: 'Payment Link',
      quantity: 2,
      website: 'http://mypos.eu',
      send_sms: true,
      send_email: true,
      ask_for_customer_name: true,
      hide_quantity: true,
      expired_date: expiredDate
    };

    console.log('Request ID:', requestId);
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('');
    
    const paymentResponse = await axios({
      method: 'POST',
      url: 'https://transactions-api.mypos.com/v1.1/online-payments/link',
      headers: {
        'API-Key': API_KEY,
        'X-Request-ID': requestId,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: requestBody
    });

    console.log('✅ Payment link created successfully!\n');
    console.log('📊 Payment Link Details:');
    console.log(JSON.stringify(paymentResponse.data, null, 2));
    console.log('');

    if (paymentResponse.data.payment_url) {
      console.log('🎉 SUCCESS!');
      console.log('═══════════════════════════════════════════════════════');
      console.log('💰 Payment URL:');
      console.log(paymentResponse.data.payment_url);
      console.log('═══════════════════════════════════════════════════════');
      console.log('\n🌐 Open this URL in your browser to test payment!');
    }

  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 401) {
        console.log('\n⚠️  Authentication failed!');
        console.log('💡 Check your Client ID and Client Secret');
      } else if (error.response.status === 400) {
        console.log('\n⚠️  Bad Request!');
        console.log('💡 Check the request body format and required fields');
      } else if (error.response.status === 500) {
        console.log('\n⚠️  Server Error from myPOS!');
        console.log('💡 This might be an issue with:');
        console.log('   - API endpoint version');
        console.log('   - Request format');
        console.log('   - Missing required fields');
        console.log('   - Invalid API-Key format');
      }
      
      if (error.response.data?.error === 'invalid_client') {
        console.log('\n⚠️  Your credentials need activation!');
        console.log('📧 Contact myPOS support: support@mypos.com');
        console.log('📋 Request: "Please activate my REST API credentials"');
        console.log('📋 Provide Client ID:', CLIENT_ID);
      }
    } else if (error.request) {
      console.error('❌ Network Error:');
      console.error('Could not reach myPOS API');
      console.error('Error:', error.message);
      console.error('\n💡 This might be a DNS/network issue.');
      console.error('💡 Try running this script from your local machine.');
    } else {
      console.error('❌ Error:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

testPaymentLink();

