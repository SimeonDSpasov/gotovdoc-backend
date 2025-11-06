#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping GotovDoc Backend Development Server...${NC}"

# Stop PM2 processes
echo -e "${YELLOW}Stopping PM2 processes...${NC}"
pm2 delete all 2>/dev/null || echo "No PM2 processes running"

# Stop LibreOffice headless service
echo -e "${YELLOW}Stopping LibreOffice service...${NC}"
pkill -f "soffice.*2002" 2>/dev/null && echo "LibreOffice stopped" || echo "No LibreOffice service running"

echo -e "${GREEN}All services stopped${NC}"

