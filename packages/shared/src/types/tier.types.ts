import type { TierLevel } from '../enums.js';

export interface FeatureFlags {
  teamsBot: boolean;
  multiStageApprovals: boolean;
  serviceNowIntegration: boolean;
  jiraIntegration: boolean;
  customReportSchedules: boolean;
  siemExport: boolean;
  exchangeConnector: boolean;
  sharePointConnector: boolean;
  fileServerConnector: boolean;
  multipleEnvironments: boolean;
  haDeployment: boolean;
  auditRetentionDays: number;
}

export const TIER_FEATURES: Record<TierLevel, FeatureFlags> = {
  1: {
    teamsBot: false,
    multiStageApprovals: false,
    serviceNowIntegration: false,
    jiraIntegration: false,
    customReportSchedules: false,
    siemExport: false,
    exchangeConnector: false,
    sharePointConnector: false,
    fileServerConnector: false,
    multipleEnvironments: false,
    haDeployment: false,
    auditRetentionDays: 90,
  },
  2: {
    teamsBot: true,
    multiStageApprovals: true,
    serviceNowIntegration: true,
    jiraIntegration: true,
    customReportSchedules: true,
    siemExport: false,
    exchangeConnector: true,
    sharePointConnector: true,
    fileServerConnector: false,
    multipleEnvironments: true,
    haDeployment: false,
    auditRetentionDays: 365,
  },
  3: {
    teamsBot: true,
    multiStageApprovals: true,
    serviceNowIntegration: true,
    jiraIntegration: true,
    customReportSchedules: true,
    siemExport: true,
    exchangeConnector: true,
    sharePointConnector: true,
    fileServerConnector: true,
    multipleEnvironments: true,
    haDeployment: true,
    auditRetentionDays: 2555,
  },
};
