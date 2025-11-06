# LibreOffice PDF Conversion Methods

This project supports two methods for converting DOCX to PDF using LibreOffice.

## Method 1: soffice Direct (Local Development - macOS)

**Used when:**
- Running on macOS (`process.platform === 'darwin'`)
- Not in production mode
- Or when `USE_SOFFICE_DIRECT=true` is set

**How it works:**
- Spawns a fresh LibreOffice process for each conversion
- Uses: `/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf`
- No background service needed
- More reliable on macOS where unoconv connections can be problematic

**Pros:**
- No need to manage a persistent LibreOffice service
- Works immediately on macOS after installing LibreOffice
- Simpler setup for local development

**Cons:**
- Slightly slower (spawns new process each time)
- Not ideal for high-volume production use

## Method 2: unoconv with Headless Service (Production - Docker/Linux)

**Used when:**
- Running on Linux
- `NODE_ENV=production`
- `DOCKER_CONTAINER=true`
- Or when `USE_SOFFICE_DIRECT=false` is set

**How it works:**
- Connects to a persistent LibreOffice headless service running on port 2002
- Uses: `unoconv -c socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext`
- Background service must be running

**Pros:**
- Faster conversions (reuses persistent service)
- Better for high-volume production use
- Standard approach in Docker/Linux environments

**Cons:**
- Requires managing a background LibreOffice service
- Can have connection issues on macOS

## Environment Variables

### Auto-detection (default)
The system automatically chooses the right method based on your environment.

### Manual Override
Set these environment variables to manually control the conversion method:

```bash
# Force soffice direct method
USE_SOFFICE_DIRECT=true

# Force unoconv method
USE_SOFFICE_DIRECT=false

# Custom LibreOffice path (if not in standard location)
LIBREOFFICE_PATH=/custom/path/to/soffice

# Custom connection string for unoconv
LIBREOFFICE_CONNECTION="socket,host=127.0.0.1,port=2002;urp;StarOffice.ComponentContext"
```

## Local Development Setup

### macOS
```bash
# Install LibreOffice
brew install --cask libreoffice

# Start the app (runs automatically with npm start)
npm start
```

### Linux
```bash
# Install LibreOffice and unoconv
sudo apt-get install libreoffice unoconv

# Start headless service
soffice --headless --accept="socket,host=127.0.0.1,port=2002;urp;" --nofirststartwizard &

# Start app
npm start
```

## Production Deployment (Railway/Docker)

The Dockerfile handles everything:
- Installs LibreOffice and unoconv
- Sets `DOCKER_CONTAINER=true`
- Starts headless LibreOffice service via docker-entrypoint.sh
- Uses unoconv method automatically

No additional configuration needed!

## Troubleshooting

### Timeout errors on macOS
If you see "unoconv timed out", the system will automatically fall back to soffice direct method on next run, or you can force it:
```bash
export USE_SOFFICE_DIRECT=true
npm start
```

### "soffice not found" error
Install LibreOffice:
```bash
brew install --cask libreoffice
```

### Connection errors in Docker
Make sure the LibreOffice headless service is running:
```bash
ps aux | grep soffice
lsof -i :2002
```

