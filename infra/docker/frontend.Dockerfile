# Frontend SSR Dockerfile (placeholder - will be finalized after app is generated)
FROM node:20 AS build
WORKDIR /app
COPY apps/frontend/package*.json ./
RUN npm ci || true
COPY apps/frontend .
RUN npm run build || true

FROM node:20
WORKDIR /app
COPY --from=build /app/dist ./dist
EXPOSE 4200
CMD ["node", "dist/server/main.js"]
