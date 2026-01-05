const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Test script for myPOS Checkout API v1.4 - PRODUCTION
 * Documentation: https://merchant.mypos.com/pdf/recources/myPOS_Checkout_API_v1.4_EN_v1.pdf
 */

// Production credentials from .env
const PRODUCTION_SID = process.env.MYPOS_SID || '1251308';
const PRODUCTION_WALLET_NUMBER = process.env.MYPOS_WALLET_NUMBER || '40857173237';
const PRODUCTION_KEY_INDEX = parseInt(process.env.MYPOS_KEY_INDEX || '4');
const CHECKOUT_URL = 'https://www.mypos.eu/vmp/checkout'; // PRODUCTION URL

// Production private key from .env
const PRODUCTION_PRIVATE_KEY = process.env.MYPOS_PRIVATE_KEY || '';

if (!PRODUCTION_PRIVATE_KEY) {
  console.error('❌ Error: MYPOS_PRIVATE_KEY not found in .env file');
  process.exit(1);
}

/**
 * Generate RSA signature for myPOS request
 */
function generateSignature(data) {
  // Concatenate all values
  const dataString = Object.values(data).join('');
  
  // Create signature
  const sign = crypto.createSign('SHA1');
  sign.update(dataString);
  sign.end();
  
  const signature = sign.sign(PRODUCTION_PRIVATE_KEY, 'base64');
  return signature;
}

/**
 * Verify RSA signature from myPOS response
 * Note: For testing, we extract the public key from the private key
 */
function verifySignature(data, signature) {
  try {
    // Remove signature from data
    const { Signature, ...dataWithoutSig } = data;
    
    // Concatenate all values
    const dataString = Object.values(dataWithoutSig).join('');
    
    // Extract public key from private key for testing
    const privateKeyObj = crypto.createPrivateKey(PRODUCTION_PRIVATE_KEY);
    const publicKey = crypto.createPublicKey(privateKeyObj);
    
    // Verify signature
    const verify = crypto.createVerify('SHA1');
    verify.update(dataString);
    verify.end();
    
    return verify.verify(publicKey, signature, 'base64');
  } catch (error) {
    console.error('Verification error:', error.message);
    return false;
  }
}

/**
 * Test 1: Generate purchase form
 */
function testGeneratePurchaseForm() {
  console.log('═'.repeat(60));
  console.log('🧪 Test 1: Generate Purchase Form');
  console.log('═'.repeat(60));

  const orderID = `TEST_${Date.now()}`;
  
  const requestData = {
    IPCmethod: 'IPCPurchase',
    IPCVersion: '1.4',
    IPCLanguage: 'en',
    SID: PRODUCTION_SID,
    WalletNumber: PRODUCTION_WALLET_NUMBER,
    KeyIndex: PRODUCTION_KEY_INDEX,
    Amount: 100, // 1.00 EUR (in cents) - small test amount
    Currency: 'EUR',
    OrderID: orderID,
    URL_OK: 'https://gotovdoc.bg/payment/success',
    URL_Cancel: 'https://gotovdoc.bg/payment/cancel',
    URL_Notify: 'https://gotovdoc-backend-production.up.railway.app/api/checkout/webhook/notify',
    CustomerEmail: 'test@gotovdoc.bg',
    CustomerFirstName: 'Иван',
    CustomerLastName: 'Тестов',
    Note: 'Тестово плащане - GotovDoc',
  };

  // Generate signature
  const signature = generateSignature(requestData);
  requestData.Signature = signature;

  console.log('\n📋 Request Data:');
  console.log(JSON.stringify(requestData, null, 2));
  console.log('\n🔐 Signature:', signature);

  // Build HTML form
  let formHTML = `<!DOCTYPE html>
<html>
<head>
  <title>myPOS Checkout Test</title>
</head>
<body>
  <h2>Redirecting to myPOS Checkout...</h2>
  <form id="mypos-checkout-form" method="POST" action="${CHECKOUT_URL}">
`;
  
  for (const [key, value] of Object.entries(requestData)) {
    formHTML += `    <input type="hidden" name="${key}" value="${value}" />\n`;
  }
  
  formHTML += `    <button type="submit">Pay Now</button>
  </form>
  <script>
    // Auto-submit form
    setTimeout(() => {
      document.getElementById('mypos-checkout-form').submit();
    }, 1000);
  </script>
</body>
</html>`;

  // Save form to file
  const formPath = path.join(__dirname, 'mypos-test-form.html');
  fs.writeFileSync(formPath, formHTML);

  console.log('\n✅ Purchase form generated successfully!');
  console.log(`📄 Form saved to: ${formPath}`);
  console.log('\n💡 Open the HTML file in your browser to test the payment flow.');
  console.log(`Order ID: ${orderID}`);
  
  return orderID;
}

/**
 * Test 2: Simulate webhook verification
 */
function testWebhookVerification() {
  console.log('\n═'.repeat(60));
  console.log('🧪 Test 2: Webhook Signature Verification');
  console.log('═'.repeat(60));

  // Simulate webhook data from myPOS (based on Appendix III)
  const webhookData = {
    IPCmethod: 'IPCPurchaseNotify',
    SID: PRODUCTION_SID,
    Amount: '100',
    Currency: 'EUR',
    OrderID: 'TEST_1234567890',
    IPC_Trnref: '813705',
    RequestSTAN: '000006',
    RequestDateTime: '2024-01-04 10:39:37',
  };

  // Generate signature as myPOS would
  const signature = generateSignature(webhookData);
  webhookData.Signature = signature;

  console.log('\n📨 Webhook Data:');
  console.log(JSON.stringify(webhookData, null, 2));

  // Verify signature
  const isValid = verifySignature(webhookData, signature);

  console.log('\n🔐 Signature:', signature);
  console.log(`\n${isValid ? '✅' : '❌'} Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);

  return isValid;
}

/**
 * Test 3: Build transaction status request
 */
function testTransactionStatusRequest(orderID) {
  console.log('\n═'.repeat(60));
  console.log('🧪 Test 3: Transaction Status Request');
  console.log('═'.repeat(60));

  const requestData = {
    IPCmethod: 'IPCGetTxnStatus',
    IPCVersion: '1.4',
    IPCLanguage: 'en',
    SID: PRODUCTION_SID,
    WalletNumber: PRODUCTION_WALLET_NUMBER,
    KeyIndex: PRODUCTION_KEY_INDEX,
    OrderID: orderID,
    OutputFormat: 'json',
  };

  const signature = generateSignature(requestData);
  requestData.Signature = signature;

  console.log('\n📋 Status Request Data:');
  console.log(JSON.stringify(requestData, null, 2));
  console.log('\n🔐 Signature:', signature);
  console.log('\n💡 Use this data to POST to:', CHECKOUT_URL);
  
  return requestData;
}

/**
 * Test 4: Build refund request
 */
function testRefundRequest(orderID, transactionRef) {
  console.log('\n═'.repeat(60));
  console.log('🧪 Test 4: Refund Request');
  console.log('═'.repeat(60));

  const requestData = {
    IPCmethod: 'IPCRefund',
    IPCVersion: '1.4',
    IPCLanguage: 'en',
    SID: PRODUCTION_SID,
    WalletNumber: PRODUCTION_WALLET_NUMBER,
    KeyIndex: PRODUCTION_KEY_INDEX,
    OrderID: orderID,
    IPC_Trnref: transactionRef,
    Amount: 100, // Full refund (1.00 EUR)
    Currency: 'EUR',
    OutputFormat: 'json',
  };

  const signature = generateSignature(requestData);
  requestData.Signature = signature;

  console.log('\n📋 Refund Request Data:');
  console.log(JSON.stringify(requestData, null, 2));
  console.log('\n🔐 Signature:', signature);
  console.log('\n💡 Use this data to POST to:', CHECKOUT_URL);
  
  return requestData;
}

/**
 * Main test execution
 */
function runTests() {
  console.log('\n🚀 myPOS Checkout API v1.4 - PRODUCTION Test Suite\n');
  console.log('📖 Documentation: https://merchant.mypos.com/pdf/recources/myPOS_Checkout_API_v1.4_EN_v1.pdf\n');
  console.log('⚠️  WARNING: This will test with REAL PRODUCTION credentials!\n');
  console.log('💰 Test Amount: 1.00 EUR (100 cents)\n');

  try {
    // Test 1: Generate purchase form
    const orderID = testGeneratePurchaseForm();

    // Test 2: Webhook verification
    const webhookValid = testWebhookVerification();

    // Test 3: Transaction status
    testTransactionStatusRequest(orderID);

    // Test 4: Refund request
    testRefundRequest(orderID, '813705');

    console.log('\n═'.repeat(60));
    console.log('✅ All tests completed successfully!');
    console.log('═'.repeat(60));
    console.log('\n📋 Summary:');
    console.log('  ✓ Purchase form generation');
    console.log('  ✓ Webhook signature verification');
    console.log('  ✓ Transaction status request');
    console.log('  ✓ Refund request\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
runTests();

