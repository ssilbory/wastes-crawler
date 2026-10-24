# Builds the static game with pnpm, then serves it with an unprivileged nginx on port 8080.
# Base images are pinned by digest; Dependabot (.github/dependabot.yml) proposes updates.
FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM nginxinc/nginx-unprivileged:stable-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03
# Security headers and caching (docker/default.conf, docker/security-headers.conf).
COPY docker/security-headers.conf /etc/nginx/security-headers.conf
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
