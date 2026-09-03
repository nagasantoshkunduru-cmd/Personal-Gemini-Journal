# Production Dockerfile for Cloud Run / Render / Containerized deployment
FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Install build dependencies temporarily
RUN npm i --save-dev typescript @types/node esbuild vite @vitejs/plugin-react @tailwindcss/vite tailwindcss

# Copy application source code
COPY . .

# Build frontend and compile backend
RUN npm run build

# Remove development files to keep image lightweight
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
