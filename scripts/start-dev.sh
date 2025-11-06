#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting GotovDoc Backend Development Server...${NC}"

# Build the project first
echo -e "${GREEN}Building TypeScript...${NC}"
npm run build

# Check if LibreOffice is installed
if [ -d "/Applications/LibreOffice.app" ]; then
  echo -e "${GREEN}LibreOffice found, starting headless service...${NC}"
  
  # Kill any existing LibreOffice instances on port 2002
  pkill -f "soffice.*2002" 2>/dev/null
  
  # Start LibreOffice headless service
  /Applications/LibreOffice.app/Contents/MacOS/soffice \
    --headless \
    --accept="socket,host=127.0.0.1,port=2002;urp;" \
    --nofirststartwizard \
    --norestore \
    --invisible \
    > /dev/null 2>&1 &
  
  LIBREOFFICE_PID=$!
  echo -e "${GREEN}LibreOffice started (PID: $LIBREOFFICE_PID)${NC}"
  
  # Wait a moment for LibreOffice to start
  sleep 2
else
  echo -e "${YELLOW}Warning: LibreOffice not found at /Applications/LibreOffice.app${NC}"
  echo -e "${YELLOW}PDF conversion will not work. Install with: brew install --cask libreoffice${NC}"
fi

# Start PM2 with ecosystem config
echo -e "${GREEN}Starting PM2 processes...${NC}"
pm2 start ecosystem.config.js --env dev && pm2 logs

