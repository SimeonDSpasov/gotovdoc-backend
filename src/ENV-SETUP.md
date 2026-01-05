# Environment Variables Setup

Add these variables to your `.env` file in the `src copy/` directory:

```bash
# Environment
Project_ENV=dev # dev | test | prod

# Server
PORT=3000

# Database
# MongoDB connection string will be constructed from the env in config.ts

# Redis
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=gotovdoc

# Email
EMAIL_PASSWORD=your-email-password

# JWT Secrets
JWT_ACCESS_SECRET=your-access-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# MyPOS Configuration
# ------------------------------

# MyPOS REST API v1.1 (Payment Links & Buttons)
# Get these from: https://my.mypos.com/en/account/api-credentials
MYPOS_CLIENT_ID=your-client-id
MYPOS_CLIENT_SECRET=your-client-secret

# MyPOS Checkout API v1.4 (Embedded Checkout)
# PRODUCTION VALUES:
MYPOS_SID="1251308"
MYPOS_WALLET_NUMBER="40857173237"
MYPOS_KEY_INDEX="4"
MYPOS_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIICXAIBAAKBgQDkzjwIsY6jiPjrdNX5iXJju5pOuthUPlgtq8og7XRTIOurUh5q
mvU/9tlQC+cavl94cPDp/h1Gffi4sVcbnwZMvpcT9+wlQEbabAd7zLcgyc570532
hjNVgk+MARLBwSZ3e996fHGKHcWQJOPjjqToCi5BCwbpRWGISGp3UQ99xwIDAQAB
AoGBAMtvSxV3uZlRyfCf+zhZquld/j8OBhYxMHm7CoboWcsntCKpav3iNTjgJCv1
yU+QAJa35JxIIoNwsdqVYxvd8txOs1nN+lIjpQUEJxhSjxBVHSzbhW74cA7dEZCd
dWBzKXRleuXTgOhSz6FCOQuACkIkhukngWIjV1/l1Tqy89+BAkEA/Q8swNUouMds
+k9xRkVezb3m6IR8TXKwHzbZ8pG+ymkqc7jyRHS5RzDQoibHRNaUB1EKwVjDeUyT
sCiK/kJZYQJBAOd26FNEpDtopke1lClKaDXW4TOG4NVIYsLy0Unv5mDdjMrtkjLY
GNQn9/l9SQZ7xIet0W60ecJx7AE+oDQf4CcCQHsPbBYCEqF46Xf4Nf+UMHwgwy+D
bedDxH4JcIdTdNJ9vdU0tSuxD4CdLngMH49MQgQk1vQbNEPCh3d838qxfUECQF7F
zyaZCm3Q0ZS3Am1NrBGvZBJG/bQWqWmNJqiRc9Dhpg5I6/2pgbEMlHoxFD91Wej8
AK7Fcr1tC+cOj2YITy0CQHtFhz4oXBMXkSaco+esGVJTX/xxH5QdQJdxiDn7Nk2X
FLEy51Og3q9aRZ82yZl8BdTgvCsPMKVF8QhKKRt1aPw=
-----END RSA PRIVATE KEY-----"

MYPOS_PUBLIC_CERT="-----BEGIN CERTIFICATE-----
MIICDTCCAXagAwIBAgIEQtqG2zANBgkqhkiG9w0BAQsFADAdMQswCQYDVQQGEwJC
RzEOMAwGA1UEChMFbXlQT1MwHhcNMjYwMTA1MDAxNTE3WhcNMzYwMTAzMDAxNTE3
WjAdMQswCQYDVQQGEwJCRzEOMAwGA1UEChMFbXlQT1MwgZ8wDQYJKoZIhvcNAQEB
BQADgY0AMIGJAoGBAKY8bk1bKwCbd9AIYiYQ78R2o9EsWuVKQB0c84NNkrJqisaD
35MYmvKVcpFIzjqJRjAaIiMPLN4GAWKUtDPm+nadPclavl0EkUHZjCZHTLaPpB1A
D+gdBNsxN0ybbO3gjLjNZF0hxh8sx6g1W3bePEb5f0iXjy7P6YffwOyGdT9NAgMB
AAGjWjBYMB0GA1UdDgQWBBSSZ6eOADkmnqV+Cev7PnYNwR6jWzAfBgNVHSMEGDAW
gBSSZ6eOADkmnqV+Cev7PnYNwR6jWzAJBgNVHRMEAjAAMAsGA1UdDwQEAwIE8DAN
BgkqhkiG9w0BAQsFAAOBgQCHXmV4jGJtEDVWHrhp5QICMwa4Z98LZRjqpi/pFo++
4FQqdUABsuJkuGaUdiz1JMx1nHdpwVjeo3Pe/jRqoIaPLLwIVRiC3bLKJjzsqlWN
7E0p9HtEn/0/IQkH0vB+VLka/Dnbeu4UEinOIlcDS0Zo3cWoiI6PL4hON0UmakWR
TQ==
-----END CERTIFICATE-----"

# MyPOS URLs (optional, will be constructed from frontendUrl in config)
MYPOS_SUCCESS_URL=
MYPOS_CANCEL_URL=
MYPOS_WEBHOOK_SECRET=
```

## Important Notes

1. **Never commit your `.env` file** - It should be in `.gitignore`
2. **Multi-line keys**: The private key and certificate are multi-line. Make sure to include them exactly as shown with the quotes.
3. **Environment**: Set `Project_ENV=prod` for production, `dev` for development
4. **Frontend URL**: The `frontendUrl` is automatically determined from `Project_ENV` in `config.ts`

## Quick Setup

```bash
# 1. Navigate to backend directory
cd "src copy"

# 2. Create .env file
cp ENV-SETUP.md .env

# 3. Edit .env and paste the values above
nano .env

# 4. Install dependencies (if not already done)
npm install

# 5. Start the server
npm run dev
```

## Verification

Test if credentials are loaded correctly:

```bash
# Start your backend server
npm run dev

# In another terminal, test the create-order endpoint
curl -X POST http://localhost:3000/api/payment/create-order \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"id": "test", "type": "document", "name": "Test", "price": 10}],
    "customerEmail": "test@example.com"
  }'
```

You should receive a response with `paymentParams` including a `Signature` field.

