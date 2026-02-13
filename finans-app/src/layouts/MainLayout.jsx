import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Briefcase,
  TrendingUp,
  Newspaper,
  Settings,
  Search,
  User,
  MessageCircle,
  X,
  Send,
  Menu
} from 'lucide-react';
import CommandPalette from '../components/CommandPalette';
import './MainLayout.css';

const navigation = [
  { name: 'Portfolio', href: '/', icon: Briefcase },
  { name: 'News', href: '/news', icon: Newspaper },
  { name: 'Markets', href: '/markets', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const exampleQuestions = [
  "What does an interest rate hike mean?",
  "Is high inflation good or bad for stocks?",
  "How do I diversify my portfolio?",
  "What's the difference between ETFs and mutual funds?"
];

export default function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const location = useLocation();

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    const userMsg = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setTimeout(() => {
      const response = getAIResponse(userMsg);
      setChatHistory(prev => [...prev, { role: 'assistant', content: response }]);
    }, 800);
  };

  const getAIResponse = (question) => {
    const q = question.toLowerCase();
    if (q.includes('interest rate') || q.includes('rate hike')) {
      return "An interest rate hike is when central banks increase the cost of borrowing money. This typically slows economic growth by making loans more expensive, which can reduce inflation. For investors, higher rates often lead to lower stock valuations, as future earnings become less valuable in present terms. Bond yields typically rise, which can make fixed-income investments more attractive.";
    }
    if (q.includes('inflation') && q.includes('stock')) {
      return "The relationship between inflation and stocks is nuanced. Moderate inflation (2-3%) is generally healthy for equities, as it reflects growing demand. However, high inflation erodes purchasing power and can compress profit margins. During high inflation, value stocks and commodities often outperform growth stocks. Real assets like real estate and certain sectors like energy tend to provide better inflation hedges.";
    }
    if (q.includes('diversif')) {
      return "Portfolio diversification means spreading investments across different asset classes, sectors, and geographies to reduce risk. A well-diversified portfolio might include domestic and international stocks, bonds with varying maturities, real estate, and commodities. The goal is to ensure that poor performance in one area doesn't disproportionately impact your overall returns.";
    }
    if (q.includes('etf') && q.includes('mutual')) {
      return "ETFs and mutual funds both offer diversification, but differ in key ways. ETFs trade on exchanges like stocks, allowing intraday buying and selling at market prices. They typically have lower expense ratios and are more tax-efficient. Mutual funds are priced once daily and may have minimum investment requirements.";
    }
    return "That's a thoughtful question about financial markets. Understanding market fundamentals, maintaining a long-term perspective, and staying informed about economic indicators are key to making sound investment decisions. Would you like me to elaborate on any specific aspect?";
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
        aria-label="Ask Finance AI"
      >
        <MessageCircle size={22} />
      </button>

      {/* Command Palette */}
      <CommandPalette isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

      {/* AI Chat Panel */}
      <div className={`chat-panel ${chatOpen ? 'open' : ''}`}>
        <div className="chat-header">
          <h3 className="chat-title">Ask Finance AI</h3>
          <button className="chat-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
            <X size={18} />
          </button>
        </div>

        <div className="chat-messages">
          {chatHistory.length === 0 ? (
            <div className="chat-welcome">
              <div className="welcome-icon"><MessageCircle size={32} /></div>
              <h4>How can I help you?</h4>
              <p>Ask me anything about finance, markets, or economics.</p>
            </div>
          ) : (
            chatHistory.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                <div className="message-bubble">{msg.content}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {chatHistory.length === 0 && (
          <div className="chat-examples">
            <span className="examples-label">Try asking:</span>
            <div className="examples-list">
              {exampleQuestions.slice(0, 2).map((q, idx) => (
                <button key={idx} className="example-btn" onClick={() => setChatMessage(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input"
            placeholder="Ask anything about finance..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
          />
          <button type="submit" className="chat-send-btn" disabled={!chatMessage.trim()} aria-label="Send">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
