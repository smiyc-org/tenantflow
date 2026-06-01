import type { WorkloadType } from '../enums.js';

export interface ConnectorStatusDto {
  workloadType: WorkloadType;
  enabled: boolean;
  lastTestedAt?: string;
  lastTestOk?: boolean;
  lastError?: string;
}

export interface AdConnectorConfigDto {
  ldapUrl: string;
  bindDn: string;
  bindPassword: string;
  baseDn: string;
  tlsEnabled: boolean;
  nestedGroupMaxDepth?: number;
}

export interface EntraConnectorConfigDto {
  tenantId: string;
  clientId: string;
  certPath: string;
  certThumbprint: string;
  usePim?: boolean;
}

export interface ExchangeConnectorConfigDto {
  tenantId: string;
  clientId: string;
  certPath: string;
  certThumbprint: string;
}

export interface SharePointConnectorConfigDto {
  tenantId: string;
  clientId: string;
  certPath: string;
  certThumbprint: string;
  tenantName: string;
}

export interface FileServerConnectorConfigDto {
  winrmHost: string;
  winrmPort?: number;
  username: string;
  password: string;
  useHttps?: boolean;
}
