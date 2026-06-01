import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

const tenantId = import.meta.env['VITE_ENTRA_TENANT_ID'] as string;
const clientId = import.meta.env['VITE_ENTRA_CLIENT_ID'] as string;

export const msalInstance = new PublicClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message) => {
        if (level === LogLevel.Error) console.error(message);
      },
    },
  },
});

export const loginRequest = {
  scopes: [`api://${clientId}/access_as_user`],
};
