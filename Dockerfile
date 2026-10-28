FROM node:20-alpine AS node-deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

FROM nginx:alpine

# Node.js installieren
RUN apk add --no-cache nodejs

# Nginx-Konfiguration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Statische Dateien
COPY . /usr/share/nginx/html/

# Node Mail-Server
COPY --from=node-deps /app/node_modules /app/node_modules
COPY mail.js /app/mail.js

# Startskript
RUN printf '#!/bin/sh\nnode /app/mail.js &\nnginx -g "daemon off;"\n' > /start.sh && chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
