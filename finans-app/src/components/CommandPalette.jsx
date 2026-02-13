import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, TrendingUp, Newspaper } from 'lucide-react';
import './CommandPalette.css';

const DEBOUNCE_MS = 300;

export default function CommandPalette({ isOpen, onClose }) {
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState({ stocks: [], crypto: [], news: [] });
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const debounceRef = useRef(null);

    // Cache market data so we only fetch once per session
    const cacheRef = useRef({ crypto: null, bist: null, us: null });

    // Focus input on open
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setResults({ stocks: [], crypto: [], news: [] });
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    // Fetch market data (cached)
    const fetchMarketData = useCallback(async (market) => {
        if (cacheRef.current[market]) return cacheRef.current[market];
        try {
            const res = await fetch(`/api/markets/${market}`);
            const json = await res.json();
            if (json.ok && json.result?.quotes) {
                const data = json.result.quotes.map(q => ({
                    symbol: q.symbol,
                    name: q.name || q.symbol,
                    price: Number(q.price) || 0,
                    change: Number(q.changePercent) || 0,
                    market,
                }));
                cacheRef.current[market] = data;
                return data;
            }
        } catch { /* ignore */ }
        return [];
    }, []);

    // Search logic
    const performSearch = useCallback(async (term) => {
        if (!term || term.length < 1) {
            setResults({ stocks: [], crypto: [], news: [] });
            setLoading(false);
            return;
        }

        setLoading(true);
        const q = term.toLowerCase();

        try {
            // Fetch all market data in parallel
            const [crypto, bist, us] = await Promise.all([
                fetchMarketData('crypto'),
                fetchMarketData('bist'),
                fetchMarketData('us'),
            ]);

            // Filter locally
            const filterAssets = (assets) =>
                assets.filter(a =>
                    a.symbol.toLowerCase().includes(q) ||
                    a.name.toLowerCase().includes(q)
                ).slice(0, 5);

            const cryptoResults = filterAssets(crypto);
            const stockResults = [...filterAssets(bist), ...filterAssets(us)].slice(0, 5);

            // Fetch news (quick search)
            let newsResults = [];
            try {
                const newsRes = await fetch(`/api/news?category=us&limit=5`);
                const newsJson = await newsRes.json();
                if (newsJson.ok && newsJson.result?.items) {
                    newsResults = newsJson.result.items
                        .filter(n => n.title?.toLowerCase().includes(q))
                        .slice(0, 3)
                        .map(n => ({
                            title: n.title,
                            source: n.source,
                            url: n.url,
                            category: n.category,
                        }));
                }
            } catch { /* news is non-critical */ }

            setResults({
                stocks: stockResults,
                crypto: cryptoResults,
                news: newsResults,
            });
            setActiveIndex(0);
        } catch {
            setResults({ stocks: [], crypto: [], news: [] });
        } finally {
            setLoading(false);
        }
    }, [fetchMarketData]);

    // Debounced search
    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => performSearch(val), DEBOUNCE_MS);
    };

    // All flat items for keyboard nav
    const allItems = [
        ...results.crypto.map(r => ({ type: 'crypto', ...r })),
        ...results.stocks.map(r => ({ type: 'stock', ...r })),
        ...results.news.map(r => ({ type: 'news', ...r })),
    ];

    // Handle selection
    const handleSelect = (item) => {
        onClose();
        if (item.type === 'news') {
            window.open(item.url, '_blank', 'noopener');
        } else {
            navigate(`/asset/${item.market}/${item.symbol}`);
        }
    };

    // Keyboard navigation
    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => Math.min(prev + 1, allItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && allItems[activeIndex]) {
            e.preventDefault();
            handleSelect(allItems[activeIndex]);
        }
    };

    const formatPrice = (price, market) => {
        if (market === 'bist') return `₺${price.toFixed(2)}`;
        if (market === 'crypto' && price < 1) return `$${price.toFixed(4)}`;
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (!isOpen) return null;

    let itemIndex = -1;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
                {/* Search Input */}
                <div className="cp-search-wrapper">
                    <Search size={18} className="cp-search-icon" />
                    <input
                        ref={inputRef}
                        type="text"
                        className="cp-search-input"
                        placeholder="Search stocks, crypto, news..."
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                    />
                    <span className="cp-shortcut">ESC</span>
                </div>

                {/* Results */}
                <div className="cp-results">
                    {loading && (
                        <div className="cp-loading">
                            <Loader2 size={20} className="spin" />
                        </div>
                    )}

                    {!loading && query && allItems.length === 0 && (
                        <div className="cp-empty">
                            <Search size={24} />
                            <p>No results for "{query}"</p>
                        </div>
                    )}

                    {!loading && !query && (
                        <div className="cp-empty">
                            <TrendingUp size={24} />
                            <p>Type to search stocks, crypto & news</p>
                        </div>
                    )}

                    {/* Crypto Results */}
                    {!loading && results.crypto.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-title">Crypto</div>
                            {results.crypto.map((item) => {
                                itemIndex++;
                                const idx = itemIndex;
                                return (
                                    <div
                                        key={`crypto-${item.symbol}`}
                                        className={`cp-item ${activeIndex === idx ? 'active' : ''}`}
                                        onClick={() => handleSelect({ type: 'crypto', ...item })}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                    >
                                        <div className="cp-item-icon crypto">
                                            {item.symbol.slice(0, 2)}
                                        </div>
                                        <div className="cp-item-info">
                                            <div className="cp-item-title">{item.symbol}</div>
                                            <div className="cp-item-subtitle">{item.name}</div>
                                        </div>
                                        <span className="cp-item-price">{formatPrice(item.price, 'crypto')}</span>
                                        <span className={`cp-item-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                                            {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Stock Results */}
                    {!loading && results.stocks.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-title">Stocks</div>
                            {results.stocks.map((item) => {
                                itemIndex++;
                                const idx = itemIndex;
                                return (
                                    <div
                                        key={`stock-${item.market}-${item.symbol}`}
                                        className={`cp-item ${activeIndex === idx ? 'active' : ''}`}
                                        onClick={() => handleSelect({ type: 'stock', ...item })}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                    >
                                        <div className={`cp-item-icon ${item.market}`}>
                                            {item.symbol.slice(0, 2)}
                                        </div>
                                        <div className="cp-item-info">
                                            <div className="cp-item-title">{item.symbol}</div>
                                            <div className="cp-item-subtitle">{item.name}</div>
                                        </div>
                                        <span className="cp-item-price">{formatPrice(item.price, item.market)}</span>
                                        <span className={`cp-item-change ${item.change >= 0 ? 'positive' : 'negative'}`}>
                                            {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* News Results */}
                    {!loading && results.news.length > 0 && (
                        <div className="cp-section">
                            <div className="cp-section-title">News</div>
                            {results.news.map((item, i) => {
                                itemIndex++;
                                const idx = itemIndex;
                                return (
                                    <div
                                        key={`news-${i}`}
                                        className={`cp-item ${activeIndex === idx ? 'active' : ''}`}
                                        onClick={() => handleSelect({ type: 'news', ...item })}
                                        onMouseEnter={() => setActiveIndex(idx)}
                                    >
                                        <div className="cp-item-icon news">
                                            <Newspaper size={16} />
                                        </div>
                                        <div className="cp-item-info">
                                            <div className="cp-item-title">{item.title}</div>
                                            <div className="cp-item-subtitle">{item.source}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="cp-footer">
                    <span><kbd>&uarr;</kbd><kbd>&darr;</kbd> navigate</span>
                    <span><kbd>Enter</kbd> select</span>
                    <span><kbd>Esc</kbd> close</span>
                </div>
            </div>
        </div>
    );
}
