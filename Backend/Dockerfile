# Use Node.js LTS version
FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies for Puppeteer with minimal footprint
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Add memory optimization flags
ENV NODE_OPTIONS="--max-old-space-size=384"
ENV CHROME_BIN=/usr/bin/chromium

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 