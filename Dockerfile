FROM refinedev/node:18 AS base
WORKDIR /app

FROM base AS deps
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --frozen-lockfile; \
    else echo "Lockfile not found." && exit 1; \
    fi

FROM base AS builder
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
ENV NODE_ENV=production

COPY --from=builder /app/dist /usr/share/nginx/html

RUN <<'EOF'
cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_proxied any;
  gzip_comp_level 6;
  gzip_buffers 16 8k;
  gzip_http_version 1.1;
  gzip_types
    text/plain
    text/css
    application/javascript
    application/json
    application/xml
    image/svg+xml;
  gzip_vary on;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location = /50x.html {
    root /usr/share/nginx/html;
  }

  error_page 500 502 503 504 /50x.html;
}
NGINX
EOF

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
