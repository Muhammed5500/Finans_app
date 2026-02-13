import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  TrendingUp,
  Newspaper,
  Settings,
  Search,
  User,
  X,
  Send,
  Menu,
  Loader2,
  Bot,
} from 'lucide-react';
import CommandPalette from '../components/CommandPalette';
import './MainLayout.css';

const PORTFOLIO_STORAGE_KEY = 'finans_portfolio_holdings';

const navigation = [
  { name: 'Portfolio', href: '/', icon: Briefcase },
  { name: 'News', href: '/news', icon: Newspaper },
  { name: 'Markets', href: '/markets', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const exampleQuestions = [
  "Portföyüm dengeli mi?",
  "Faiz artışı ne demek?",
  "Portföyümü nasıl çeşitlendirebilirim?",
  "Bugün piyasalarda ne oldu?",
];

export default function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);
  const location = useLocation();

  // Ctrl+K for command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [location.pathname]);

  // Focus input when chat opens
  useEffect(() => {
    if (chatOpen) setTimeout(() => chatInputRef.current?.focus(), 300);
  }, [chatOpen]);

  // Listen for custom event from News page to open chat with context
  useEffect(() => {
    const handler = (e) => {
      const { message } = e.detail || {};
      if (message) {
        setChatOpen(true);
        setChatMessage(message);
      }
    };
    window.addEventListener('kamil-ai-ask', handler);
    return () => window.removeEventListener('kamil-ai-ask', handler);
  }, []);

  // ─── Build context from localStorage + current page ────────────
  const buildContext = useCallback(() => {
    const ctx = { currentPage: location.pathname };
    try {
      const raw = localStorage.getItem(PORTFOLIO_STORAGE_KEY);
      if (raw) {
        const holdings = JSON.parse(raw);
        ctx.holdings = holdings.map(h => ({
          symbol: h.symbol,
          market: h.market,
          quantity: h.quantity,
          avgCost: h.avgCost,
        }));
      }
    } catch { /* ignore */ }
    return ctx;
  }, [location.pathname]);

  // ─── Send message to Gemini ─────────────────────────────────────
  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    const msg = chatMessage.trim();
    if (!msg || chatLoading) return;

    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context: buildContext() }),
      });
      const json = await res.json();

      if (json.ok && json.result?.reply) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: json.result.reply }]);
      } else {
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: json.error || 'Yanıt alınamadı. Lütfen tekrar deneyin.',
        }]);
      }
    } catch {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Bağlantı hatası. finans-api sunucusunun çalıştığından emin olun.',
      }]);
    }

    setChatLoading(false);
  }, [chatMessage, chatLoading, buildContext]);

  // ─── Quick-fill example question ────────────────────────────────
  const handleExampleClick = (q) => {
    setChatMessage(q);
    chatInputRef.current?.focus();
  };

  return (
    <div className="app-layout">
      {/* Top Navigation Bar */}
      <header className="topnav">
        <NavLink to="/" className="topnav-brand">
          <div className="logo-mark">
            <span className="logo-k">K</span>
          </div>
          <span className="logo-text">Kamil Finance</span>
        </NavLink>

        <nav className="topnav-links">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => `topnav-link ${isActive ? 'active' : ''}`}
              end={item.href === '/'}
            >
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="topnav-actions">
          <button
            className="topnav-icon-btn"
            onClick={() => setCommandPaletteOpen(true)}
            title="Search (Ctrl+K)"
          >
            <Search size={18} />
          </button>
          <button className="topnav-icon-btn" title="Profile">
            <User size={18} />
          </button>
          <button
            className="topnav-icon-btn mobile-only"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Overlay */}
      {mobileMenuOpen && <div className="mobile-overlay" onClick={() => setMobileMenuOpen(false)} />}

      {/* Mobile Slide Menu */}
      <div className={`mobile-nav ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-nav-header">
          <div className="logo-mark"><span className="logo-k">K</span></div>
          <span className="logo-text">Kamil Finance</span>
          <button className="mobile-close" onClick={() => setMobileMenuOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <nav className="mobile-nav-links">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => `mobile-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
              end={item.href === '/'}
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Floating AI Chat Button */}
      <button
        className={`ai-fab ${chatOpen ? 'hidden' : ''}`}
        onClick={() => setChatOpen(true)}
        aria-label="Kamil AI"
      >
        <Bot size={22} />
      </button>

      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* Kamil AI Chat Panel */}
      <div className={`chat-panel ${chatOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <div className="chat-header-left">
            <div className="chat-avatar"><Bot size={16} /></div>
            <div>
              <h3 className="chat-title">Kamil AI</h3>
              <span className="chat-subtitle">Finans Asistanı</span>
            </div>
          </div>
          <button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
            <X size={18} />
          </button>
        </div>

        <div className="chat-messages">
          {chatHistory.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon"><Bot size={32} /></div>
              <h4>Merhaba, ben Kamil AI</h4>
              <p>Portföyün, piyasalar veya finans hakkında her şeyi sorabilirsin.</p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="msg-avatar"><Bot size={14} /></div>
                )}
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))
          )}
          {chatLoading && (
            <div className="chat-message assistant">
              <div className="msg-avatar"><Bot size={14} /></div>
              <div className="message-bubble typing">
                <Loader2 size={14} className="spin" />
                <span>Düşünüyorum...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {chatHistory.length === 0 && (
          <div className="chat-examples">
            <span className="examples-label">Bunları sorabilirsin:</span>
            <div className="examples-list">
              {exampleQuestions.map((q, idx) => (
                <button key={idx} className="example-btn" onClick={() => handleExampleClick(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            ref={chatInputRef}
            type="text"
            className="chat-input"
            placeholder="Kamil AI'a sor..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            disabled={chatLoading}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={!chatMessage.trim() || chatLoading}
            aria-label="Send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
