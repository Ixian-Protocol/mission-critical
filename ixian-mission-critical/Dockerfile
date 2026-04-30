# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

ARG NODE_MEMORY_MB=2048
ENV NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY_MB}"

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN pnpm build

# Production stage - serve static files with nginx
FROM nginx:alpine AS production

# Copy built files to nginx
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom nginx config for SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
