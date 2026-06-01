import { useAuth } from '../../auth/useAuth.js';

export function Header() {
  const { displayName, upn, logout } = useAuth();

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-gray-800">{displayName}</div>
          <div className="text-xs text-gray-500">{upn}</div>
        </div>
        <button
          onClick={logout}
          className="text-sm text-gray-500 hover:text-gray-800 transition"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
