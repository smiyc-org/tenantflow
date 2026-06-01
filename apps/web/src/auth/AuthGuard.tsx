import type { ReactNode } from 'react';
import { useAuth } from './useAuth.js';

interface Props {
  children: ReactNode;
}

export function AuthGuard({ children }: Props) {
  const { isAuthenticated, login } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-10 rounded-xl shadow-md text-center max-w-sm w-full">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-2xl font-semibold text-gray-800 mb-2">TenantFloe</h1>
          <p className="text-gray-500 mb-6 text-sm">
            Sign in with your Microsoft account to continue.
          </p>
          <button
            onClick={login}
            className="w-full bg-ms-blue hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition"
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
