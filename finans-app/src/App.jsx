import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Portfolio from './pages/Portfolio';
import Markets from './pages/Markets';
import News from './pages/News';
import Settings from './pages/Settings';
import AssetDetail from './pages/AssetDetail';
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
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Portfolio />} />
          <Route path="markets" element={<Markets />} />
          <Route path="asset/:market/:symbol" element={<AssetDetail />} />
          <Route path="news" element={<News />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
