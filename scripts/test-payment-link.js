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
    
    // Generate a unique request ID
    const generateRequestId = () => {
      const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
      return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
    };

    // Step 2: Get Accounts
    console.log('Step 2: Getting accounts...');

    const accountsResponse = await axios({
      method: 'GET',
      url: 'https://transactions-api.mypos.com/v1.1/accounts',
      headers: {
        'API-Key': API_KEY,
        'X-Request-ID': generateRequestId(),
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('✅ Accounts retrieved successfully!\n');
    console.log('📋 Accounts Data:');
    console.log(JSON.stringify(accountsResponse.data, null, 2));
    console.log('');

    // Step 3: Get Settlement Data
    console.log('\nStep 3: Getting settlement data...');

    const settlementResponse = await axios({
      method: 'GET',
      url: 'https://transactions-api.mypos.com/v1.1/online-payments/settlement-data',
      headers: {
        'API-Key': API_KEY,
        'X-Request-ID': generateRequestId(),
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    console.log('✅ Settlement data retrieved successfully!\n');
    console.log('📋 Settlement Data:');
    console.log(JSON.stringify(settlementResponse.data, null, 2));
    console.log('');

    // Step 4: Create Payment Button
    console.log('\nStep 4: Creating payment button...');
    
    const buttonResponse = await axios({
      method: 'POST',
      url: 'https://transactions-api.mypos.com/v1.1/online-payments/button',
      headers: {
        'API-Key': API_KEY,
        'X-Request-ID': generateRequestId(),
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({
        "item_name": "Example Item",
        "item_price": 343,
        "pref_language": "EN",
        "currency": "EUR",
        "account_number": "71972723",
        "custom_name": "Example Button",
        "quantity": 1,
        "website": "http://mypos.eu",
        "send_sms": true,
        "send_email": true,
        "button_size": 1,
        "ask_for_customer_name": true,
        "ask_for_shipping_address": true,
        "ask_for_customer_email": true,
        "ask_for_customer_phone": true,
        "cancel_url": "http://mypos.eu/cancel",
        "return_url": "http://mypos.eu/return"
      })
    });

    console.log('✅ Payment button created successfully!\n');
    console.log('🔘 Payment Button Details:');
    console.log(JSON.stringify(buttonResponse.data, null, 2));
    console.log('');

    // Step 5: Create Payment Link
    console.log('\nStep 5: Creating payment link...');
    
    const paymentResponse = await axios({
      method: 'POST',
      url: 'https://transactions-api.mypos.com/v1.1/online-payments/link',
      headers: {
        'API-Key': API_KEY,
        'X-Request-ID': generateRequestId(),
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({"item_name":"Example Item","item_price":3341,"pref_language":"BG","currency":"EUR","account_number":"71972723","custom_name":"Payment Link","quantity":2,"website":"http://mypos.eu","ask_for_customer_name":true,"hide_quantity":true,"expired_date":"2026-10-10"})
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

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ All tests completed successfully!');
    console.log('═══════════════════════════════════════════════════════');

  } catch (error) {
    if (error.response) {
      console.error('❌ HTTP Error:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Response Headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {

        
    } else {
      console.error('❌ Error:', error.message);
      console.error('Stack:', error.stack);
    }
  }
}

testPaymentLink();

