FROM node:20-bookworm-slim AS build
WORKDIR /workspace

ARG NODE_OPTIONS=--max-old-space-size=2048
ENV NODE_OPTIONS=${NODE_OPTIONS}

COPY apps/terminal/package.json ./apps/terminal/package.json
COPY apps/terminal/package-lock.json ./apps/terminal/package-lock.json
COPY libs ./libs

WORKDIR /workspace/apps/terminal

RUN npm ci

COPY apps/terminal ./

RUN npm run build && \
    mkdir -p /tmp/backoffice-dist && \
    if [ -d dist/terminal/browser ]; then \
      cp -R dist/terminal/browser/. /tmp/backoffice-dist/; \
    else \
      cp -R dist/terminal/. /tmp/backoffice-dist/; \
    fi

FROM nginx:1.27-alpine

COPY infra/docker/frontend.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /tmp/backoffice-dist/ /usr/share/nginx/html/

EXPOSE 80
