#!/bin/bash

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Your myPOS credentials
CLIENT_ID="fvMiobLyIlwa3Qsx7Sl5TeYo"
CLIENT_SECRET="d0eGKwbSkzPrqmzj4gY8tcsbgdaLkt5LODD6vto7bNCREKzW"

echo -e "${GREEN}Testing myPOS Payment Link Creation...${NC}\n"

# Step 1: Get OAuth Token
echo -e "${YELLOW}Step 1: Getting OAuth token...${NC}"

CREDENTIALS=$(echo -n "${CLIENT_ID}:${CLIENT_SECRET}" | base64)

TOKEN_RESPONSE=$(curl -s -X POST \
  https://auth-api.mypos.com/oauth/token \
  -H "Authorization: Basic ${CREDENTIALS}" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials")

echo "Token Response:"
echo "$TOKEN_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$TOKEN_RESPONSE"

ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])" 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ]; then
  # Fallback to grep if python fails
  ACCESS_TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | sed 's/"access_token":"//')
fi

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "\n${RED}❌ Failed to get OAuth token!${NC}"
  exit 1
fi

echo -e "\n${GREEN}✓ OAuth token obtained${NC}"
echo "Access Token: $ACCESS_TOKEN"

# Step 2: Create Payment Link
echo -e "\n${YELLOW}Step 2: Creating payment link...${NC}\n"

echo "Testing payment link creation..."
echo "Using endpoint: https://api.mypos.com/v1/transactions/payment-links"
echo ""

PAYMENT_RESPONSE=$(curl -v -w "\nHTTP_STATUS:%{http_code}" -X POST \
  https://api.mypos.com/v1/transactions/payment-links \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "currency": "BGN",
    "order_id": "test-order-'$(date +%s)'",
    "customer": {
      "email": "test@example.com",
      "name": "Test User"
    },
    "note": "Test Payment Link",
    "success_url": "https://gotovdoc-backend-production.up.railway.app/payment/success",
    "cancel_url": "https://gotovdoc-backend-production.up.railway.app/payment/cancel"
  }' 2>&1)

HTTP_STATUS=$(echo "$PAYMENT_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$PAYMENT_RESPONSE" | sed '/HTTP_STATUS/d')

echo "HTTP Status: $HTTP_STATUS"
echo "Payment Link Response:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

PAYMENT_URL=$(echo $PAYMENT_RESPONSE | grep -o '"payment_url":"[^"]*' | sed 's/"payment_url":"//')

if [ ! -z "$PAYMENT_URL" ]; then
  echo -e "\n${GREEN}✓ Payment link created successfully!${NC}"
  echo -e "${GREEN}Payment URL: ${PAYMENT_URL}${NC}"
  echo -e "\n${YELLOW}Open this URL in your browser to test payment:${NC}"
  echo "$PAYMENT_URL"
else
  echo -e "\n${RED}❌ Failed to create payment link${NC}"
fi

