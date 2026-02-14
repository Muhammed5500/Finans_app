import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Portfolio from './pages/Portfolio';
import Markets from './pages/Markets';
import News from './pages/News';
import AssetDetail from './pages/AssetDetail';
import Login from './pages/Login';
import './App.css';

function App() {
  // Apply persisted theme on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('finans_theme') || 'dark';
      const resolved = saved === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : saved;
      document.documentElement.dataset.theme = resolved;
    } catch { /* ignore */ }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Portfolio />} />
              <Route path="markets" element={<Markets />} />
              <Route path="asset/:market/:symbol" element={<AssetDetail />} />
              <Route path="news" element={<News />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
