# myPOS Payment Integration

This document describes the myPOS payment gateway integration for GotovDoc.

## Overview

The integration uses the [myPOS REST API](https://developers.mypos.com/en/doc/more_apis/v1_0/3-more-apis) to create payment links and receive webhook notifications for payment status updates.

## Flow

### 1. Document Creation & Payment Link Generation

```
User submits form → Backend creates document → Backend generates payment link → Frontend receives payment URL
```

**Endpoint:** `POST /api/doc/speciment`

**Request Body:**
```json
{
  "three_names": "John Doe",
  "egn": "1234567890",
  "id_number": "123456",
  "id_year": "2023",
  "id_issuer": "Sofia",
  "company_name": "Test Company",
  "company_adress": "Test Address",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "507f1f77bcf86cd799439011",
  "paymentUrl": "https://pay.mypos.com/payment-link-id",
  "message": "Please complete payment to download your document"
}
```

### 2. Payment Processing

The frontend redirects the user to `paymentUrl`. After payment:
- **Success:** User is redirected to `MYPOS_SUCCESS_URL` (e.g., `/payment/success?orderId=...`)
- **Cancel:** User is redirected to `MYPOS_CANCEL_URL` (e.g., `/payment/cancel?orderId=...`)

### 3. Webhook Notification

When payment is completed, myPOS sends a webhook to our backend:

**Endpoint:** `POST /api/payment/webhook/mypos`

**Webhook Payload (example):**
```json
{
  "event_type": "payment.completed",
  "payment_link_id": "pl_123456",
  "order_id": "507f1f77bcf86cd799439011",
  "status": "success",
  "amount": 10,
  "currency": "BGN",
  "timestamp": "2025-11-11T12:00:00Z"
}
```

The backend updates the document's payment status in the database.

### 4. Document Download

Once payment is confirmed:

**Endpoint:** `GET /api/doc/download/:orderId`

Returns the generated PDF document if payment was successful.

## API Endpoints

### Document Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/doc/speciment` | Create document and generate payment link |
| GET | `/api/doc/download/:orderId` | Download PDF after successful payment |

### Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payment/webhook/mypos` | Webhook receiver for myPOS notifications |
| GET | `/api/payment/status/:orderId` | Check payment status for an order |

## Configuration

Add the following environment variables to your `.env` file:

```bash
# MyPOS Configuration
MYPOS_CLIENT_ID=your_client_id_here
MYPOS_CLIENT_SECRET=your_client_secret_here
MYPOS_SUCCESS_URL=http://localhost:4200/payment/success
MYPOS_CANCEL_URL=http://localhost:4200/payment/cancel
MYPOS_WEBHOOK_SECRET=your_webhook_secret_here
```

### Getting myPOS Credentials

1. Go to your [myPOS Account](https://www.mypos.com)
2. Navigate to API Credentials section
3. Generate new Client ID and Client Secret
4. Save the credentials securely

### Webhook Setup

1. Log in to your myPOS account
2. Go to Webhooks configuration
3. Add webhook URL: `https://your-domain.com/api/payment/webhook/mypos`
4. Select events to listen for:
   - `payment.completed`
   - `payment.failed`
5. Save the webhook secret for signature validation

## Testing

### Test Environment

myPOS provides a sandbox environment for testing:
- Auth URL: `https://sandbox-auth-api.mypos.com/oauth/token`
- API URL: `https://sandbox-api.mypos.com`

Set `Project_ENV=dev` or `Project_ENV=test` to use sandbox environment.

### Test Payment Flow

1. Create a document:
```bash
curl -X POST http://localhost:3000/api/doc/speciment \
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

2. Visit the returned `paymentUrl` to complete payment

3. Check payment status:
```bash
curl http://localhost:3000/api/payment/status/{orderId}
```

4. Download document after payment:
```bash
curl http://localhost:3000/api/doc/download/{orderId} --output document.pdf
```

## Security

### Webhook Signature Validation

The webhook endpoint should validate incoming requests using HMAC signature:

```typescript
// TODO: Implement signature validation
const signature = req.headers['x-mypos-signature'];
const payload = JSON.stringify(req.body);
const expectedSignature = crypto
  .createHmac('sha256', MYPOS_WEBHOOK_SECRET)
  .update(payload)
  .digest('hex');

if (signature !== expectedSignature) {
  throw new Error('Invalid webhook signature');
}
```

## Frontend Integration

### Example React Flow

```typescript
// 1. Submit form and get payment URL
const response = await fetch('/api/doc/speciment', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(formData)
});

const { orderId, paymentUrl } = await response.json();

// 2. Redirect to payment
window.location.href = paymentUrl;

// 3. On success page, poll for payment status
const checkPayment = async () => {
  const status = await fetch(`/api/payment/status/${orderId}`);
  const { paid } = await status.json();
  
  if (paid) {
    // Download document
    window.location.href = `/api/doc/download/${orderId}`;
  }
};

// Poll every 2 seconds
const interval = setInterval(checkPayment, 2000);
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized**
   - Check `MYPOS_CLIENT_ID` and `MYPOS_CLIENT_SECRET`
   - Ensure credentials are base64 encoded correctly

2. **Webhook not received**
   - Verify webhook URL is publicly accessible
   - Check firewall/security group settings
   - Ensure webhook is registered in myPOS dashboard

3. **Payment link creation fails**
   - Verify API credentials are correct
   - Check if using correct environment (sandbox vs production)
   - Review logs for detailed error messages

## References

- [myPOS Developer Documentation](https://developers.mypos.com)
- [OAuth Documentation](https://developers.mypos.com/en/doc/more_apis/v1_0/3-more-apis)
- [Transactions API](https://developers.mypos.com/en/doc/more_apis/v1_1/4-transactions-api)
- [Webhooks API](https://developers.mypos.com/en/doc/more_apis/v1_0/5-webhooks-api)


