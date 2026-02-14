import { useState, useRef, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  TrendingUp,
  Newspaper,
  X,
  Send,
  Menu,
  Loader2,
  Bot,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import CommandPalette from '../components/CommandPalette';
import './MainLayout.css';

function portfolioStorageKey(userId) { return `finans_portfolio_holdings_${userId}`; }

const navigation = [
  { name: 'Portfolio', href: '/', icon: Briefcase },
  { name: 'News', href: '/news', icon: Newspaper },
  { name: 'Markets', href: '/markets', icon: TrendingUp },
];

const exampleQuestions = [
  "Is my portfolio balanced?",
  "What does an interest rate hike mean?",
  "How can I diversify my portfolio?",
  "What happened in the markets today?",
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('finans_theme') || 'dark'; } catch { return 'dark'; }
  });

  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('finans_theme', next);
  }, [theme]);
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

  // ─── Build context from localStorage + current page ────────────
  const buildContext = useCallback(() => {
    const ctx = { currentPage: location.pathname };
    try {
      const key = portfolioStorageKey(user?.id || 'anonymous');
      const raw = localStorage.getItem(key);
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
  }, [location.pathname, user]);

  // ─── Core send function (reusable) ─────────────────────────────
  const sendMessageDirect = useCallback(async (msg) => {
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
        const errMsg = typeof json.error === 'string'
          ? json.error
          : json.error?.message || 'Could not get a response. Please try again.';
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: errMsg,
        }]);
      }
    } catch {
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Make sure finans-api is running.',
      }]);
    }

    setChatLoading(false);
  }, [chatLoading, buildContext]);

  // ─── Form submit handler ───────────────────────────────────────
  const handleSendMessage = useCallback(async (e) => {
    e.preventDefault();
    const msg = chatMessage.trim();
    sendMessageDirect(msg);
  }, [chatMessage, sendMessageDirect]);

  // Listen for custom event to open chat (optionally auto-send)
  useEffect(() => {
    const handler = (e) => {
      const { message, autoSend } = e.detail || {};
      if (message) {
        setChatOpen(true);
        if (autoSend) {
          sendMessageDirect(message);
        } else {
          setChatMessage(message);
        }
      }
    };
    window.addEventListener('kamil-ai-ask', handler);
    return () => window.removeEventListener('kamil-ai-ask', handler);
  }, [sendMessageDirect]);

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
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="theme-toggle-btn"
            onClick={logout}
            title="Sign Out"
            aria-label="Logout"
          >
            <LogOut size={18} />
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
          <button className="mobile-link mobile-theme-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            {theme === 'dark' ? 'Light Theme' : 'Dark Theme'}
          </button>
          <button className="mobile-link mobile-theme-btn" onClick={logout}>
            <LogOut size={20} />
            Sign Out
          </button>
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
              <span className="chat-subtitle">Finance Assistant</span>
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
              <h4>Hi, I'm Kamil AI</h4>
              <p>Ask me anything about your portfolio, markets, or finance.</p>
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
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {chatHistory.length === 0 && (
          <div className="chat-examples">
            <span className="examples-label">Try asking:</span>
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
            placeholder="Ask Kamil AI..."
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
