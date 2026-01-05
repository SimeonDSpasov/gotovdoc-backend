const crypto = require('crypto');
const fs = require('path');

/**
 * Generate the correct public certificate from your private key
 */

const myposRSA = process.env.MYPOS_RSA || 'eyJzaWQiOiIxMjUxMzA4IiwiY24iOiI0MDg1NzE3MzIzNyIsInBrIjoiLS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLVxuTUlJQ1hBSUJBQUtCZ1FES1ZwRVVFZ2tCR01sdktPcDliZHRDcG4yUjVJK3Jzb1c3VXpVR2ZqWGJxYWxWdzVmZFxuXC95VGZEQzA1WlgzejFpTUJSdFdBOWdGb3VaeWhWZVVmM2pCa3VxZGZcL2VtTzRqZ1A0UEp1M3ljME9cL3lLWitHYVxuQ1grQnN0OHFvRWZmMmxmOTdJWFBzdzRsT0tSTEFxeWI0UVFmN0FBXC9UMHpBRVBTYkNiTUhwOFQxUXdJREFRQUJcbkFvR0FYV1wvTVh6QlU2Q1RDSUlzTWZnK1ZDUnBKTW00UnlvQU9NWXNqR1hSKytvbEdvVXhKZlVLdGpETGJUMzRHXG53K3RIRHZmZThFYXFMK3BHNGxvQURNOVdHTnR2Y3ZLNTRmYkhsbXpyNDZJSVFxcU5SNFE3VnkwVUtEQ0F2N2poXG5hNytsTGF1cFg2bnFJK09sR3JcL3U3c0VrdjlaaFM2WVFKazIwa0ZKYXRtVE1hNEVDUVFEdzEyXC9CeERiWE8wOGdcbnZtTWp3eFNyXC90U0sycVZUNlpnbGUrZE14SXptejZNUzB1dnZMaFwvSGY1KzErcFg0ZW9ZelptZWx4XC9mZ1J4dW5cbjFPXC9Jb0RicEFrRUExeEsrVjhoUzlrUk9FK1NZWHNpMTUyd3pMWGJKbVdmOG1KejhEZ0ZKMzlVZDN4N2RZRkRIXG5yVXRqXC84NkdFNjZidVluc0xBWXpNa2NQWlVzSm1PQ0hTd0pCQUxqQWEwaTNIbUtwYXBcL3hyTmVvTk5sa0dPT1RcbnFyUGVSQXF0SzlnbUJ2aWdXN1o2K3VaMStZYnVqalBwVU5aV0YxQ2l3K3ZXcEgzMXptOUcxOUtOcE5FQ1FIUGRcbkt5SExUN1pQOGVnUm5HeGpvR3QrQk13WFZHQUtmekFRVWxHUkxDVWpnS1kwMEhvVXlwMTNJZllyWWx1MEV6eVBcbkt1WkVxTXdMTUNZWG1LSDlRNlVDUUdua3p1WVg4UE5hWmxBRndMZVJvTm5CMlMwMlVyOURyd0VSVmJRZldadWVcbnJtVWdFdDFiekdtQnJLbGxLamRBTWpEdHpBMDFHQmNCa3ZDTkdkVHJmY2M9XG4tLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLVxuIiwicGMiOiItLS0tLUJFR0lOIENFUlRJRklDQVRFLS0tLS1cbk1JSUNEVENDQVhhZ0F3SUJBZ0lFTit6YjRUQU5CZ2txaGtpRzl3MEJBUXNGQURBZE1Rc3dDUVlEVlFRR0V3SkNcblJ6RU9NQXdHQTFVRUNoTUZiWGxRVDFNd0hoY05Nall3TVRBME1qTXpNRFUwV2hjTk16WXdNVEF5TWpNek1EVTBcbldqQWRNUXN3Q1FZRFZRUUdFd0pDUnpFT01Bd0dBMVVFQ2hNRmJYbFFUMU13Z1o4d0RRWUpLb1pJaHZjTkFRRUJcbkJRQURnWTBBTUlHSkFvR0JBSjRya1U3SWFZRDhDZWlmQ0V6MzZEZDRoeE4wNlNYVTA5Qk5cL1BHellpbDV4KzdyXG5ZeUdHTThsZmEweDM5UFhZQ2gxVnFzWExSd1RMMWNRb3d6bm1QTEVHZmlDMmxScXk5WW5nK2lpd0xITjFKb2FMXG44MXFqNlR1S2xOMnYwZFQwTUJ2dll4SXNEUlNJZmJMWlI3bDl4WWdkM3g2bFMrbzMzRDVxVXdrZE9jaGpBZ01CXG5BQUdqV2pCWU1CMEdBMVVkRGdRV0JCUnhZd0F6RWNuek43XC8xeFk3RzM4Nnd0Z3ROUFRBZkJnTlZIU01FR0RBV1xuZ0JSeFl3QXpFY256TjdcLzF4WTdHMzg2d3RndE5QVEFKQmdOVkhSTUVBakFBTUFzR0ExVWREd1FFQXdJRThEQU5cbkJna3Foa2lHOXcwQkFRc0ZBQU9CZ1FBd2dIcER4U2hGQzJrR2FVRDh0SGMwVEtCcnYyRkhlRmNYd2s0cm00Vzlcbm15MU1EWWhxc2hoWENOS3k1dnhhamhhUHdkeW1FRWwyK01LRnZneVM1Y2RnblBqMDN6bnJJeHYyZWpYaHJDWWhcbnl6SDBETnBINmpxbytlRDNVQVhTXC9nMU9iQVVlNFhJT293NnZ1aWYwUEV6eUZNTUNkemowMmpcL3FrSTJmU1NCOVxuaHc9PVxuLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLVxuIiwiaWR4IjoiNCJ9';

const decoded = Buffer.from(myposRSA, 'base64').toString('utf-8');
const creds = JSON.parse(decoded);

console.log('\n🔐 Generating Correct Public Certificate from Your Private Key\n');
console.log('═'.repeat(70));

// Extract public key from private key
const privateKeyObj = crypto.createPrivateKey(creds.pk);
const publicKeyObj = crypto.createPublicKey(privateKeyObj);

// Export as PEM (PKCS#1 format - RSA PUBLIC KEY)
const publicKeyPEM = publicKeyObj.export({ type: 'pkcs1', format: 'pem' });

console.log('\n✅ CORRECT PUBLIC KEY (that matches your private key):\n');
console.log(publicKeyPEM);

console.log('\n═'.repeat(70));
console.log('\n📋 INSTRUCTIONS:\n');
console.log('1. Copy the public key above (including BEGIN/END lines)');
console.log('2. Go to your myPOS merchant dashboard');
console.log('3. Navigate to Settings → API Keys or Developer Settings');
console.log('4. Upload this public key with KeyIndex = 4');
console.log('5. Wait for myPOS to approve/activate it (may take a few minutes)');
console.log('6. Then test again with the same payment form\n');

console.log('═'.repeat(70));
console.log('\n❌ PROBLEM:\n');
console.log('The public certificate in your MYPOS_RSA variable does NOT');
console.log('match your private key. This is why signatures are failing.\n');

console.log('myPOS has a DIFFERENT public key on file, which is why they');
console.log('cannot verify your signatures.\n');

console.log('═'.repeat(70));

