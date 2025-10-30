FROM node:20-bookworm

# System deps: LibreOffice + fonts for PDF rendering
RUN apt-get update && apt-get install -y \
  libreoffice \
  fontconfig \
  fonts-dejavu \
  fonts-liberation \
  fonts-noto-core \
  && rm -rf /var/lib/apt/lists/*

ENV LIBREOFFICE_PATH=/usr/bin/soffice

WORKDIR /app
ENV PATH="/app/node_modules/.bin:${PATH}"

# Install dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

ENV NODE_ENV=production

# Expose default port (adjust if needed)
EXPOSE 3000

# Entrypoint will optionally link PM2 if keys are provided, then start pm2-runtime
ENTRYPOINT ["bash", "./docker-entrypoint.sh"]
CMD ["pm2-runtime", "ecosystem.config.js"]


