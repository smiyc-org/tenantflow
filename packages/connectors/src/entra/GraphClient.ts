import { ClientCertificateCredential } from '@azure/identity';
import { Client } from '@microsoft/microsoft-graph-client';
import { TokenCredentialAuthenticationProvider } from '@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js';

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  certPath: string;
  certThumbprint: string;
}

const GRAPH_SCOPES = ['https://graph.microsoft.com/.default'];

export function createGraphClient(config: EntraConfig): Client {
  const credential = new ClientCertificateCredential(
    config.tenantId,
    config.clientId,
    {
      certificatePath: config.certPath,
      sendCertificateChain: true,
    },
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: GRAPH_SCOPES,
  });

  return Client.initWithMiddleware({ authProvider });
}
