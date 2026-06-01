import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from './msalConfig.js';
import type { PlatformRole } from '@tenantflow/shared';

export function useAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = accounts[0];

  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect({ postLogoutRedirectUri: '/' });

  const getToken = async (): Promise<string> => {
    if (!account) throw new Error('No account');
    const result = await instance.acquireTokenSilent({ ...loginRequest, account });
    return result.accessToken;
  };

  const roles: PlatformRole[] = (account?.idTokenClaims?.['roles'] as PlatformRole[] | undefined) ?? [];

  return {
    isAuthenticated,
    account,
    login,
    logout,
    getToken,
    roles,
    displayName: account?.name ?? '',
    upn: account?.username ?? '',
  };
}
