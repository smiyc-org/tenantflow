import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import type { FastifyInstance } from 'fastify';

import databasePlugin from './plugins/database.js';
import redisPlugin from './plugins/redis.js';
import authPlugin from './plugins/auth.js';
import { healthRoutes } from './routes/health/index.js';
import { requestRoutes } from './routes/requests/index.js';
import { approvalRoutes } from './routes/approvals/index.js';
import { searchRoutes } from './routes/search/index.js';
import { auditRoutes } from './routes/audit/index.js';
import { policyRoutes } from './routes/policies/index.js';
import { userRoutes } from './routes/users/index.js';
import { ticketRoutes } from './routes/tickets/index.js';
import { reportRoutes } from './routes/reports/index.js';
import { connectorRoutes } from './routes/connectors/index.js';
import { adminRoutes } from './routes/admin/index.js';

import { ConnectorRegistry, AdConnector, EntraConnector } from '@tenantflow/connectors';
import { WorkloadType, TIER_FEATURES } from '@tenantflow/shared';
import { config } from './config.js';
import { startExecutionWorker } from './workers/executionWorker.js';
import { startRollbackWorker } from './workers/rollbackWorker.js';
import { startNotificationWorker } from './workers/notificationWorker.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
    },
    trustProxy: true,
  });

  // Security
  await fastify.register(helmet, { contentSecurityPolicy: false });
  await fastify.register(cors, { origin: true, credentials: true });
  await fastify.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  // Database + Redis + Auth
  await fastify.register(databasePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(authPlugin);

  // Build connector registry
  const registry = new ConnectorRegistry();
  const tierFeatures = TIER_FEATURES[config.license.tier];

  // AD connector (always included if configured)
  if (config.ad.ldapUrl && config.ad.bindDn) {
    registry.register(new AdConnector({
      url: config.ad.ldapUrl,
      bindDn: config.ad.bindDn,
      bindPassword: config.ad.bindPassword,
      baseDn: config.ad.baseDn,
      tlsEnabled: config.ad.ldapUrl.startsWith('ldaps'),
    }));
  }

  // Entra connector
  if (config.entra.tenantId && config.entra.clientId) {
    registry.register(new EntraConnector({
      tenantId: config.entra.tenantId,
      clientId: config.entra.clientId,
      certPath: config.entra.certPath,
      certThumbprint: config.entra.certThumbprint,
    }));
  }

  // Exchange + SharePoint (Tier 2+)
  if (tierFeatures.exchangeConnector && config.entra.tenantId) {
    const { ExchangeConnector } = await import('@tenantflow/connectors');
    registry.register(new ExchangeConnector({
      tenantId: config.entra.tenantId,
      clientId: config.entra.clientId,
      certPath: config.entra.certPath,
      certThumbprint: config.entra.certThumbprint,
    }));
  }

  if (tierFeatures.sharePointConnector && config.entra.tenantId) {
    const { SharePointConnector } = await import('@tenantflow/connectors');
    registry.register(new SharePointConnector({
      tenantId: config.entra.tenantId,
      clientId: config.entra.clientId,
      certPath: config.entra.certPath,
      certThumbprint: config.entra.certThumbprint,
      tenantName: config.entra.tenantId.split('.')[0] ?? 'tenant',
    }));
  }

  fastify.decorate('connectorRegistry', registry);
  fastify.decorate('config', { tier: config.license.tier });

  // Routes
  await fastify.register(healthRoutes);
  await fastify.register(requestRoutes);
  await fastify.register(approvalRoutes);
  await fastify.register(searchRoutes);
  await fastify.register(auditRoutes);
  await fastify.register(policyRoutes);
  await fastify.register(userRoutes);
  await fastify.register(ticketRoutes);
  await fastify.register(reportRoutes);
  await fastify.register(connectorRoutes);
  await fastify.register(adminRoutes);

  // Start BullMQ workers
  fastify.addHook('onReady', async () => {
    startExecutionWorker(fastify.db, registry);
    startRollbackWorker(fastify.db, registry);
    startNotificationWorker(fastify.db);
    fastify.log.info('BullMQ workers started');
  });

  return fastify;
}
