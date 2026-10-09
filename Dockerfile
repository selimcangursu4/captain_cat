# Kaptan Pati oyun sunucusu (yayın). Herhangi bir Docker barındırmasında çalışır (Render, Railway, Fly.io, VPS…).
# HTTPS'i barındırma sağlayıcısı ya da önündeki ters vekil (reverse proxy) sağlamalıdır: mağaza paketleri
# yalnızca https:// sunucuya bağlanır.
#   docker build -t kaptan-pati-server .
#   docker run -p 8787:8787 --env-file .env kaptan-pati-server
FROM node:24-alpine
WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY server/prisma ./server/prisma
# Kurulum betikleri kapalı: yalnızca Prisma istemcisi açıkça üretilir.
RUN npm ci --ignore-scripts && npx prisma generate

COPY tsconfig.json ./
COPY server ./server
COPY src ./src

ENV NODE_ENV=production PORT=8787
EXPOSE 8787
# Açılışta bekleyen veritabanı göçleri uygulanır, sonra sunucu başlar.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx server/src/index.ts"]
