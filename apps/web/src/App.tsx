import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/msalConfig.js';
import { AuthGuard } from './auth/AuthGuard.js';
import { AppShell } from './components/layout/AppShell.js';
import { Dashboard } from './pages/Dashboard.js';
import { NewRequest } from './pages/NewRequest.js';
import { MyRequests } from './pages/MyRequests.js';
import { RequestDetail } from './pages/RequestDetail.js';
import { Approvals } from './pages/Approvals.js';
import { AuditLog } from './pages/AuditLog.js';
import { Reports } from './pages/Reports.js';
import { AdminOverview } from './pages/admin/Overview.js';
import { AdminUsers } from './pages/admin/Users.js';

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <AuthGuard>
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/requests" element={<MyRequests />} />
                <Route path="/requests/new" element={<NewRequest />} />
                <Route path="/requests/:id" element={<RequestDetail />} />
                <Route path="/approvals" element={<Approvals />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/admin" element={<AdminOverview />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="*" element={<div className="text-gray-400 p-8">Page not found</div>} />
              </Routes>
            </AppShell>
          </AuthGuard>
        </BrowserRouter>
      </QueryClientProvider>
    </MsalProvider>
  );
}
