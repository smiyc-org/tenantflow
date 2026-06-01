import type { FastifyRequest, FastifyReply } from 'fastify';
import { TIER_FEATURES, type TierLevel } from '@tenantflow/shared';
import { config } from '../config.js';

type FeatureFlagKey = keyof typeof TIER_FEATURES[1];

export function requireFeature(flag: FeatureFlagKey) {
  return async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const tier = config.license.tier as TierLevel;
    const features = TIER_FEATURES[tier];
    const val = features[flag];

    if (val === false || val === 0) {
      reply.code(403).send({
        error: 'Feature not available on current tier',
        feature: flag,
        currentTier: tier,
      });
    }
  };
}
