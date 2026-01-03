# Manual myPOS Webhook Setup

Your credentials are getting `invalid_client` error. This typically happens when credentials are newly generated and need activation.

## Your Credentials

- **Client ID:** `mbAATdyQq6ljpbdJp5NO0Xpm`
- **Client Secret:** `7cj0JKy1D9tYkDevRWzYCP4mwhzRNJGbSqFCdFoiyJTqQart`
- **Webhook URL:** `https://gotovdoc-backend-production.up.railway.app/api/payment/webhook/mypos`

## Option 1: Contact myPOS Support (Recommended)

The credentials might need to be activated by myPOS support first.

**Email myPOS support:**
- Email: support@mypos.com
- Request: "Please activate my REST API credentials for webhook integration"
- Provide your Client ID: `mbAATdyQq6ljpbdJp5NO0Xpm`

## Option 2: Use myPOS Dashboard

1. **Log in to myPOS Dashboard**
   - Go to https://www.mypos.com
   - Log in to your account

2. **Navigate to Webhooks Section**
   - Look for "API" or "Webhooks" in settings
   - Or "Интеграция" (Integration) if in Bulgarian

3. **Manually Add Webhook**
   - Click "Add Webhook" or "Create Webhook"
   - **Payload URL:** `https://gotovdoc-backend-production.up.railway.app/api/payment/webhook/mypos`
   - **Secret:** Generate a random secret (save it!)
   - **Events to subscribe:**
     - ✅ `payment.completed`
     - ✅ `payment.failed`
     - ✅ `payment_link.completed` (if available)

4. **Save the Webhook Secret**
   - You'll need to add it to your environment variables

## Option 3: Try Manual API Calls

### Step 1: Get OAuth Token

```bash
curl -X POST https://auth-api.mypos.com/oauth/token \
  -H "Authorization: Basic bWJBQVRkeVFxNmxqcGJkSnA1Tk8wWHBtOjdjajBKS3kxRDl0WWtEZXZSV3pZQ1A0bXdoelJOSkdiU3FGQ2RGb2l5SlRxUWFydA==" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
```

**Expected response:**
```json
{
  "access_token": "YOUR_TOKEN_HERE",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Step 2: Create Webhook (if Step 1 works)

```bash
# Replace YOUR_TOKEN_HERE with token from Step 1
# Replace YOUR_SECRET with a random secure string

curl -X POST https://webhook-api.mypos.com/v1/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "payload_url=https://gotovdoc-backend-production.up.railway.app/api/payment/webhook/mypos&secret=YOUR_SECRET"
```

## After Webhook is Created

### Update Environment Variables

Add to your Railway environment variables (or `.env` for local):

```bash
MYPOS_CLIENT_ID=mbAATdyQq6ljpbdJp5NO0Xpm
MYPOS_CLIENT_SECRET=7cj0JKy1D9tYkDevRWzYCP4mwhzRNJGbSqFCdFoiyJTqQart
MYPOS_WEBHOOK_SECRET=your_webhook_secret_here
Project_ENV=prod
```

### Test the Integration

1. **Create a test document:**
```bash
curl -X POST https://gotovdoc-backend-production.up.railway.app/api/doc/speciment \
  -H "Content-Type: application/json" \
  -d '{
    "three_names": "Test User",
    "egn": "1234567890",
    "id_number": "123456",
    "id_year": "2023",
    "id_issuer": "Sofia",
    "company_name": "Test Company",
    "company_adress": "Test Address",
    "email": "test@example.com"
  }'
```

2. **You should receive:**
```json
{
  "success": true,
  "orderId": "...",
  "paymentUrl": "https://pay.mypos.com/...",
  "message": "Please complete payment to download your document"
}
```

3. **Open the payment URL** and complete test payment

4. **Webhook will be sent** to your backend automatically

5. **Check payment status:**
```bash
curl https://gotovdoc-backend-production.up.railway.app/api/payment/status/ORDER_ID
```

6. **Download document:**
```bash
curl https://gotovdoc-backend-production.up.railway.app/api/doc/download/ORDER_ID -o document.pdf
```

## Troubleshooting

### Error: "invalid_client"
- Credentials need to be activated by myPOS
- Contact support@mypos.com

### Error: "Failed to create payment link"
- Check if credentials are added to Railway environment variables
- Restart Railway deployment after adding env vars

### Webhook not received
- Check webhook is active in myPOS dashboard
- Verify webhook URL is correct
- Check Railway logs for incoming webhook requests

## Need Help?

Contact myPOS Support:
- **Email:** support@mypos.com
- **Phone:** Check myPOS website for support numbers
- **Documentation:** https://developers.mypos.com

