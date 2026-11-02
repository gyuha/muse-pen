import type { ReactNode } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router';
import { useAuth } from './auth';
import { LoginPage, SignupPage } from './pages/AuthPages';
import { WorkDetailPage } from './pages/WorkDetailPage';
import { NewWorkPage, WorksPage } from './pages/WorksPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  if (me === undefined) return <p className="muted">불러오는 중…</p>;
  if (me === null) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  const { me, logout } = useAuth();
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/">muse-pen</Link>
        {me && (
          <span>
            {me.email} <button type="button" className="secondary" onClick={() => void logout()}>로그아웃</button>
          </span>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/" element={<RequireAuth><WorksPage /></RequireAuth>} />
          <Route path="/works/new" element={<RequireAuth><NewWorkPage /></RequireAuth>} />
          <Route path="/works/:workId" element={<RequireAuth><WorkDetailPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
