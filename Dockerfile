FROM node:18-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including dev dependencies for building
RUN npm ci

# Copy source files
COPY src ./src
COPY tsconfig.json ./

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies
RUN npm ci --omit=dev

# Expose port 8000 (as documented in smithery)
EXPOSE 8000

# Start the server
CMD ["npm", "start"] 