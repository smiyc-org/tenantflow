import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { PlatformRole } from '@tenantflow/shared';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '🏠' },
  { to: '/requests/new', label: 'New Request', icon: '➕' },
  { to: '/requests', label: 'My Requests', icon: '📋' },
  { to: '/approvals', label: 'Approvals', icon: '✅', role: PlatformRole.APPROVER },
  { to: '/audit', label: 'Audit Log', icon: '🔍', role: PlatformRole.AUDITOR },
  { to: '/reports', label: 'Reports', icon: '📊' },
];

const adminItems = [
  { to: '/admin/policies', label: 'Policies', icon: '⚙️' },
  { to: '/admin/connectors', label: 'Connectors', icon: '🔌' },
  { to: '/admin/users', label: 'Users & Roles', icon: '👥' },
];

export function Sidebar() {
  const { roles } = useAuth();
  const isAdmin = roles.includes(PlatformRole.POLICY_ADMIN) || roles.includes(PlatformRole.SUPER_ADMIN);

  return (
    <aside className="w-60 bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <span className="text-lg font-semibold tracking-tight">TenantFloe</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems
          .filter((item) => !item.role || roles.includes(item.role))
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                  isActive
                    ? 'bg-ms-blue text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}

        {isAdmin && (
          <>
            <div className="pt-4 pb-1 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Admin
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                    isActive
                      ? 'bg-ms-blue text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`
                }
              >
                <span>{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
}
