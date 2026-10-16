FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-alpine AS backend-build
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app/backend
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=backend-build /app/backend/package*.json ./
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/prisma ./prisma
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/public ./public
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
EXPOSE 4000
CMD ["sh", "-c", "if [ -z \"$DATABASE_URL\" ]; then echo 'DATABASE_URL is required. In Railway, add a PostgreSQL service and set its DATABASE_URL as a variable on this app service.' >&2; exit 1; fi; npx prisma migrate deploy && npm run start"]