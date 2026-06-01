FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/connectors/package.json ./packages/connectors/
COPY packages/workflow/package.json ./packages/workflow/
COPY packages/audit/package.json ./packages/audit/
COPY packages/ticketing/package.json ./packages/ticketing/
COPY packages/search/package.json ./packages/search/
COPY packages/reporting/package.json ./packages/reporting/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
RUN pnpm --filter @tenantflow/shared build
RUN pnpm --filter @tenantflow/connectors build
RUN pnpm --filter @tenantflow/workflow build
RUN pnpm --filter @tenantflow/audit build
RUN pnpm --filter @tenantflow/ticketing build
RUN pnpm --filter @tenantflow/search build
RUN pnpm --filter @tenantflow/reporting build
RUN pnpm --filter @tenantflow/api build

FROM node:22-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
