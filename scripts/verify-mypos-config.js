const crypto = require('crypto');
require('dotenv').config();

console.log('\n🔍 Verifying myPOS Configuration\n');
console.log('═'.repeat(70));

// Check all required environment variables
const requiredVars = {
 'MYPOS_SID': process.env.MYPOS_SID,
 'MYPOS_WALLET_NUMBER': process.env.MYPOS_WALLET_NUMBER,
 'MYPOS_KEY_INDEX': process.env.MYPOS_KEY_INDEX,
 'MYPOS_PRIVATE_KEY': process.env.MYPOS_PRIVATE_KEY ? '✓ Present' : '✗ Missing',
 'MYPOS_PUBLIC_CERT': process.env.MYPOS_PUBLIC_CERT ? '✓ Present' : '✗ Missing',
};

console.log('📋 Environment Variables:');
for (const [key, value] of Object.entries(requiredVars)) {
 console.log(`  ${key}: ${value}`);
}

console.log('\n═'.repeat(70));

// Verify keys are valid
if (process.env.MYPOS_PRIVATE_KEY && process.env.MYPOS_PUBLIC_CERT) {
 try {
  const privateKey = process.env.MYPOS_PRIVATE_KEY;
  const publicCert = process.env.MYPOS_PUBLIC_CERT;
  
  // Test signature generation
  const testData = 'test123';
  const sign = crypto.createSign('SHA1');
  sign.update(testData);
  sign.end();
  const signature = sign.sign(privateKey, 'base64');
  
  // Test signature verification
  const verify = crypto.createVerify('SHA1');
  verify.update(testData);
  verify.end();
  const isValid = verify.verify(publicCert, signature, 'base64');
  
  console.log('\n🔐 Key Pair Test:');
  console.log(`  Signature Generation: ✓ Success`);
  console.log(`  Signature Verification: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
  
  if (!isValid) {
   console.log('\n❌ ERROR: Your private key and public certificate DO NOT MATCH!');
   console.log('   This will cause signature failures with myPOS.');
  } else {
   console.log('\n✅ Keys are valid and match!');
  }
 } catch (error) {
  console.log('\n❌ ERROR testing keys:', error.message);
 }
}

console.log('\n═'.repeat(70));
console.log('\n📝 Common Reasons for Error Code 2:\n');
console.log('1. ❌ Merchant account not fully activated');
console.log('2. ❌ Online payments not enabled in merchant dashboard');
console.log('3. ❌ Business verification documents pending');
console.log('4. ❌ API integration not approved by myPOS');
console.log('5. ❌ Test/Sandbox mode still active (need production approval)');
console.log('6. ❌ Wrong SID or Wallet Number');
console.log('7. ❌ KeyIndex not matching the uploaded certificate');

console.log('\n═'.repeat(70));
console.log('\n💡 Next Steps:\n');
console.log('1. Log into your myPOS merchant dashboard');
console.log('2. Check Settings → Online Payments → Status');
console.log('3. Verify your account is "ACTIVE" for online payments');
console.log('4. Check if there are pending verification documents');
console.log('5. Contact myPOS support: merchant@mypos.com');
console.log('   Subject: "Activate Online Payments - SID 1251308"\n');
console.log('═'.repeat(70));
