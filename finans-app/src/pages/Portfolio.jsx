import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Trash2,
    X,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Star,
    TrendingUp,
    TrendingDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    PieChart,
    Pie,
    Cell,
    Sector,
    AreaChart,
    Area,
    XAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import './Portfolio.css';

// ─── Constants ──────────────────────────────────────────────────────────────

function storageKey(userId) { return `finans_portfolio_holdings_${userId}`; }
function favoritesKey(userId) { return `finans_favorites_${userId}`; }
const PRICE_REFRESH_INTERVAL = 30000;
const MARKET_OPTIONS = [
    { value: 'bist', label: 'BIST', currency: '₺' },
    { value: 'us', label: 'US', currency: '$' },
    { value: 'crypto', label: 'Crypto', currency: '$' },
    { value: 'forex', label: 'Forex', currency: '' },
    { value: 'commodity', label: 'Commodity', currency: '$' },
    { value: 'fund', label: 'Fund/ETF', currency: '$' },
];

const MARKET_COLORS = {
    bist: '#4ade80',
    us: '#86efac',
    crypto: '#22c55e',
    forex: '#60a5fa',
    commodity: '#f59e0b',
    fund: '#a78bfa',
};

const MARKET_LABELS = {
    bist: 'BIST',
    us: 'US Stocks',
    crypto: 'Crypto',
    forex: 'Forex',
    commodity: 'Commodities',
    fund: 'Funds/ETF',
};

const TIME_RANGES = ['1D', '3M', '1Y', 'TIME'];

const TIME_RANGE_LABELS = { '1D': 'Today', '3M': '3 Months', '1Y': '1 Year', 'TIME': 'All Time' };

const CHART_RANGE_CONFIG = {
    '1D': {
        bist: { interval: '5m', range: '1d' },
        us: { rangeDays: 1 },
        crypto: { interval: '5m', limit: 288 },
        forex: { rangeDays: 1 },
        commodity: { rangeDays: 1 },
        fund: { rangeDays: 1 },
    },
    '3M': {
        bist: { interval: '1d', range: '3mo' },
        us: { rangeDays: 90 },
        crypto: { interval: '1d', limit: 90 },
        forex: { rangeDays: 90 },
        commodity: { rangeDays: 90 },
        fund: { rangeDays: 90 },
    },
    '1Y': {
        bist: { interval: '1d', range: '1y' },
        us: { rangeDays: 365 },
        crypto: { interval: '1d', limit: 365 },
        forex: { rangeDays: 365 },
        commodity: { rangeDays: 365 },
        fund: { rangeDays: 365 },
    },
    'TIME': {
        bist: { interval: '1d', range: 'max' },
        us: { rangeDays: 365 },
        crypto: { interval: '1d', limit: 1000 },
        forex: { rangeDays: 365 },
        commodity: { rangeDays: 365 },
        fund: { rangeDays: 365 },
    },
};

const AVATAR_COLORS = [
    '#3fb950', '#f85149', '#58a6ff', '#7c72ff', '#d29922',
    '#f0883e', '#bc8cff', '#3fb950', '#58a6ff', '#f85149',
    '#7c72ff', '#d29922', '#f0883e', '#bc8cff',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadHoldings(userId) {
    try {
        const stored = localStorage.getItem(storageKey(userId));
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

function saveHoldings(holdings, userId) {
    localStorage.setItem(storageKey(userId), JSON.stringify(holdings));
}

function loadFavorites(userId) {
    try {
        const stored = localStorage.getItem(favoritesKey(userId));
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
}

function saveFavorites(favorites, userId) {
    localStorage.setItem(favoritesKey(userId), JSON.stringify(favorites));
}

async function fetchPrice(market, symbol) {
    try {
        let url;
        if (market === 'bist') url = `/api/bist/quote?symbol=${encodeURIComponent(symbol)}`;
        else if (market === 'us') url = `/api/us/quote?symbol=${encodeURIComponent(symbol)}`;
        else if (market === 'crypto') url = `/api/crypto/24hr?symbol=${encodeURIComponent(symbol)}`;
        else if (market === 'forex' || market === 'commodity' || market === 'fund')
            url = `/api/yahoo/quote?symbol=${encodeURIComponent(symbol)}`;
        if (!url) return null;

        const res = await fetch(url);
        const json = await res.json();
        if (!json.ok || !json.result) return null;

        const result = json.result;
        if (market === 'crypto') {
            return {
                price: parseFloat(result.data.lastPrice),
                change: parseFloat(result.data.priceChangePercent),
                name: result.displayName || symbol,
            };
        }
        return {
            price: result.price ?? result.regularMarketPrice,
            change: result.changePercent ?? result.regularMarketChangePercent,
            name: result.name || result.shortName || symbol,
        };
    } catch { return null; }
}

function formatCurrency(value, market) {
    if (value == null || isNaN(value)) return '—';
    if (market === 'bist')
        return `₺${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatShort(value) {
    if (value == null || isNaN(value)) return '—';
    return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(val) {
    if (val == null || isNaN(val)) return '—';
    return `${val >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`;
}

function formatQuantity(qty) {
    if (qty < 0.01) return qty.toFixed(6);
    if (qty < 1) return qty.toFixed(4);
    if (qty % 1 === 0) return qty.toLocaleString('en-US');
    return qty.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Chart data helpers ─────────────────────────────────────────────────────

async function fetchHoldingChart(market, symbol, timeRange) {
    try {
        const config = CHART_RANGE_CONFIG[timeRange]?.[market];
        let url;

        if (market === 'bist') {
            const interval = config?.interval || '1d';
            const range = config?.range || '3mo';
            url = `/api/bist/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}&range=${range}`;
        } else if (market === 'crypto') {
            const interval = config?.interval || '1d';
            const limit = config?.limit || 90;
            url = `/api/crypto/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;
        } else {
            // us, forex, commodity, fund → /api/us/chart
            const rangeDays = config?.rangeDays || 90;
            url = `/api/us/chart?symbol=${encodeURIComponent(symbol)}&rangeDays=${rangeDays}`;
        }

        const res = await fetch(url);
        const json = await res.json();
        if (!json.ok || !json.result) return [];

        if (market === 'crypto') {
            const klines = json.result.data || [];
            return klines.map(k => ({
                time: typeof k[0] === 'number' ? k[0] : parseInt(k[0]),
                close: parseFloat(k[4]),
            })).filter(d => !isNaN(d.close));
        }

        const candles = json.result.candles || [];
        return candles.map(c => ({
            time: new Date(c.time).getTime(),
            close: c.close,
        })).filter(d => !isNaN(d.close));
    } catch {
        return [];
    }
}

function aggregatePortfolioChart(holdingsData) {
    if (holdingsData.length === 0) return [];

    const allTimestamps = new Set();
    for (const h of holdingsData) {
        for (const dp of h.dataPoints) allTimestamps.add(dp.time);
    }
    if (allTimestamps.size === 0) return [];

    const sorted = [...allTimestamps].sort((a, b) => a - b);

    for (const h of holdingsData) {
        h.dataPoints.sort((a, b) => a.time - b.time);
    }

    const result = [];
    const lastKnown = new Array(holdingsData.length).fill(null);
    const ptrs = new Array(holdingsData.length).fill(0);

    for (const ts of sorted) {
        let total = 0;

        for (let i = 0; i < holdingsData.length; i++) {
            const h = holdingsData[i];

            // Always advance pointer (track price)
            while (ptrs[i] < h.dataPoints.length && h.dataPoints[ptrs[i]].time <= ts) {
                lastKnown[i] = h.dataPoints[ptrs[i]].close;
                ptrs[i]++;
            }

            // If before purchase date, count this holding's value as 0
            if (h.purchaseTime && ts < h.purchaseTime) continue;

            if (lastKnown[i] != null) {
                total += h.quantity * lastKnown[i];
            }
        }

        // Always produce data point (0 before purchase, actual value after)
        result.push({ time: ts, value: +total.toFixed(2) });
    }

    // Thin to ~60 points for a smooth chart
    if (result.length > 80) {
        const step = Math.ceil(result.length / 60);
        const thinned = [];
        for (let i = 0; i < result.length; i += step) thinned.push(result[i]);
        if (thinned[thinned.length - 1] !== result[result.length - 1]) {
            thinned.push(result[result.length - 1]);
        }
        return thinned;
    }

    return result;
}

function formatChartLabel(timestamp, range) {
    const d = new Date(timestamp);
    if (range === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (range === '3M') return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    if (range === '1Y') return d.toLocaleDateString('en-US', { month: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

// ─── Chart tooltip ──────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="chart-tooltip">
            <span className="chart-tooltip-value">{formatShort(payload[0].value)}</span>
        </div>
    );
};

// ─── Pie Active Shape ───────────────────────────────────────────────────────

const renderActiveShape = (props) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
    return (
        <g>
            <Sector cx={cx} cy={cy} innerRadius={innerRadius - 2} outerRadius={outerRadius + 6}
                startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>
    );
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function Portfolio() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id || 'anonymous';
    const [holdings, setHoldings] = useState(() => loadHoldings(userId));
    const [prices, setPrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [timeRange, setTimeRange] = useState('3M');
    const refreshTimerRef = useRef(null);

    // Favorites
    const [favorites, setFavorites] = useState(() => loadFavorites(userId));
    const [favPrices, setFavPrices] = useState({});
    const [favLoading, setFavLoading] = useState(false);
    const [showAddFav, setShowAddFav] = useState(false);
    const [favMarket, setFavMarket] = useState('us');
    const [favSymbol, setFavSymbol] = useState('');
    const [favSymbolOptions, setFavSymbolOptions] = useState([]);
    const [favSymbolsLoading, setFavSymbolsLoading] = useState(false);
    const [showFavDropdown, setShowFavDropdown] = useState(false);
    const [favHighlight, setFavHighlight] = useState(-1);
    const favDropdownRef = useRef(null);

    useEffect(() => { saveFavorites(favorites, userId); }, [favorites, userId]);

    // Form
    const [formMarket, setFormMarket] = useState('us');
    const [formSymbol, setFormSymbol] = useState('');
    const [formQuantity, setFormQuantity] = useState('');
    const [formPrice, setFormPrice] = useState('');
    const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [formError, setFormError] = useState('');

    // Symbol autocomplete
    const [symbolOptions, setSymbolOptions] = useState([]);
    const [symbolsLoading, setSymbolsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const symbolCacheRef = useRef({});
    const dropdownRef = useRef(null);
    const symbolInputRef = useRef(null);

    useEffect(() => { saveHoldings(holdings, userId); }, [holdings, userId]);

    // Reload data when user changes
    useEffect(() => {
        setHoldings(loadHoldings(userId));
        setFavorites(loadFavorites(userId));
        setPrices({});
        setFavPrices({});
    }, [userId]);

    // ── Symbol autocomplete — fetch market symbols ──────────────────────
    useEffect(() => {
        if (!showAddForm) return;
        if (symbolCacheRef.current[formMarket]) {
            setSymbolOptions(symbolCacheRef.current[formMarket]);
            return;
        }
        let cancelled = false;
        setSymbolsLoading(true);
        fetch(`/api/markets/${formMarket}`)
            .then(res => res.json())
            .then(json => {
                if (cancelled) return;
                const quotes = json?.result?.quotes || [];
                const opts = quotes.map(q => ({ symbol: q.symbol, name: q.name || q.symbol }));
                symbolCacheRef.current[formMarket] = opts;
                setSymbolOptions(opts);
            })
            .catch(() => { if (!cancelled) setSymbolOptions([]); })
            .finally(() => { if (!cancelled) setSymbolsLoading(false); });
        return () => { cancelled = true; };
    }, [formMarket, showAddForm]);

    // Reset symbol when market changes
    useEffect(() => {
        setFormSymbol('');
        setHighlightIndex(-1);
    }, [formMarket]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filtered symbol list
    const filteredSymbols = useMemo(() => {
        const query = formSymbol.trim().toLowerCase();
        const filtered = query
            ? symbolOptions.filter(o =>
                o.symbol.toLowerCase().includes(query) ||
                o.name.toLowerCase().includes(query)
            )
            : symbolOptions;
        return filtered.slice(0, 50);
    }, [formSymbol, symbolOptions]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (highlightIndex < 0) return;
        const container = dropdownRef.current?.querySelector('.symbol-dropdown');
        const item = container?.children[highlightIndex];
        if (item) item.scrollIntoView({ block: 'nearest' });
    }, [highlightIndex]);

    const handleSymbolSelect = useCallback((symbol) => {
        setFormSymbol(symbol);
        setShowDropdown(false);
        setHighlightIndex(-1);
    }, []);

    const handleSymbolKeyDown = useCallback((e) => {
        if (!showDropdown || filteredSymbols.length === 0) {
            if (e.key === 'ArrowDown' && filteredSymbols.length > 0) {
                setShowDropdown(true);
                setHighlightIndex(0);
                e.preventDefault();
            }
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev => (prev + 1) % filteredSymbols.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev => (prev - 1 + filteredSymbols.length) % filteredSymbols.length);
        } else if (e.key === 'Enter' && highlightIndex >= 0) {
            e.preventDefault();
            handleSymbolSelect(filteredSymbols[highlightIndex].symbol);
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
            setHighlightIndex(-1);
        }
    }, [showDropdown, filteredSymbols, highlightIndex, handleSymbolSelect]);

    // ── Favorite symbol autocomplete ────────────────────────────────────
    useEffect(() => {
        if (!showAddFav) return;
        if (symbolCacheRef.current[favMarket]) {
            setFavSymbolOptions(symbolCacheRef.current[favMarket]);
            return;
        }
        let cancelled = false;
        setFavSymbolsLoading(true);
        fetch(`/api/markets/${favMarket}`)
            .then(res => res.json())
            .then(json => {
                if (cancelled) return;
                const quotes = json?.result?.quotes || [];
                const opts = quotes.map(q => ({ symbol: q.symbol, name: q.name || q.symbol }));
                symbolCacheRef.current[favMarket] = opts;
                setFavSymbolOptions(opts);
            })
            .catch(() => { if (!cancelled) setFavSymbolOptions([]); })
            .finally(() => { if (!cancelled) setFavSymbolsLoading(false); });
        return () => { cancelled = true; };
    }, [favMarket, showAddFav]);

    const filteredFavSymbols = useMemo(() => {
        const q = favSymbol.trim().toLowerCase();
        const list = q
            ? favSymbolOptions.filter(o => o.symbol.toLowerCase().includes(q) || o.name.toLowerCase().includes(q))
            : favSymbolOptions;
        return list.slice(0, 50);
    }, [favSymbol, favSymbolOptions]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (favDropdownRef.current && !favDropdownRef.current.contains(e.target)) setShowFavDropdown(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleAddFavorite = useCallback((symbol) => {
        const sym = (symbol || favSymbol).trim().toUpperCase();
        if (!sym) return;
        const exists = favorites.find(f => f.symbol === sym && f.market === favMarket);
        if (!exists) {
            setFavorites(prev => [...prev, { symbol: sym, market: favMarket }]);
        }
        setFavSymbol('');
        setShowAddFav(false);
        setShowFavDropdown(false);
    }, [favSymbol, favMarket, favorites]);

    const handleRemoveFavorite = useCallback((symbol, market) => {
        setFavorites(prev => prev.filter(f => !(f.symbol === symbol && f.market === market)));
    }, []);

    // ── Prices (holdings + favorites) ────────────────────────────────────
    const refreshPrices = useCallback(async () => {
        const allItems = [
            ...holdings.map(h => ({ market: h.market, symbol: h.symbol })),
            ...favorites.filter(f => !holdings.some(h => h.symbol === f.symbol && h.market === f.market)),
        ];
        if (allItems.length === 0) return;
        setLoadingPrices(true);
        const results = await Promise.all(
            allItems.map(async (item) => {
                const key = `${item.market}:${item.symbol}`;
                const result = await fetchPrice(item.market, item.symbol);
                return { key, result };
            })
        );
        const updated = {};
        for (const { key, result } of results) { if (result) updated[key] = result; }
        setPrices(prev => ({ ...prev, ...updated }));
        setFavPrices(prev => ({ ...prev, ...updated }));
        setLoadingPrices(false);
    }, [holdings, favorites]);

    useEffect(() => {
        refreshPrices();
        refreshTimerRef.current = setInterval(refreshPrices, PRICE_REFRESH_INTERVAL);
        return () => clearInterval(refreshTimerRef.current);
    }, [refreshPrices]);

    // ── Add Holding ─────────────────────────────────────────────────────
    const handleAddHolding = async (e) => {
        e.preventDefault();
        setFormError('');
        const symbol = formSymbol.trim().toUpperCase();
        const quantity = parseFloat(formQuantity);
        const price = parseFloat(formPrice);
        if (!symbol) { setFormError('Symbol required'); return; }
        if (isNaN(quantity) || quantity <= 0) { setFormError('Enter a valid quantity'); return; }
        if (isNaN(price) || price <= 0) { setFormError('Enter a valid purchase price'); return; }
        if (!formDate) { setFormError('Purchase date required'); return; }

        const purchaseDate = new Date(formDate + 'T00:00:00').toISOString();

        const exists = holdings.find(h => h.symbol === symbol && h.market === formMarket);
        if (exists) {
            const totalQty = exists.quantity + quantity;
            const totalCost = (exists.quantity * exists.avgCost) + (quantity * price);
            // Use the earliest date as purchase date
            const earlierDate = new Date(exists.purchaseDate || exists.addedAt) < new Date(purchaseDate)
                ? (exists.purchaseDate || exists.addedAt) : purchaseDate;
            setHoldings(prev => prev.map(h =>
                (h.symbol === symbol && h.market === formMarket)
                    ? { ...h, quantity: totalQty, avgCost: totalCost / totalQty, purchaseDate: earlierDate } : h
            ));
        } else {
            setHoldings(prev => [...prev, {
                id: Date.now().toString(), symbol, market: formMarket,
                quantity, avgCost: price, purchaseDate, addedAt: new Date().toISOString(),
            }]);
        }

        const priceResult = await fetchPrice(formMarket, symbol);
        if (priceResult) setPrices(prev => ({ ...prev, [`${formMarket}:${symbol}`]: priceResult }));

        setFormSymbol(''); setFormQuantity(''); setFormPrice('');
        setFormDate(new Date().toISOString().split('T')[0]); setShowAddForm(false);
    };

    const handleDelete = (id) => { setHoldings(prev => prev.filter(h => h.id !== id)); setDeleteConfirm(null); };

    // ── Computed Data ───────────────────────────────────────────────────
    const enrichedHoldings = useMemo(() => {
        return holdings.map(h => {
            const priceData = prices[`${h.market}:${h.symbol}`];
            const currentPrice = priceData?.price ?? null;
            const totalCost = h.quantity * h.avgCost;
            const currentValue = currentPrice != null ? h.quantity * currentPrice : null;
            const profitLoss = currentValue != null ? currentValue - totalCost : null;
            const profitLossPercent = totalCost > 0 && profitLoss != null ? (profitLoss / totalCost) * 100 : null;
            return { ...h, name: priceData?.name || h.symbol, currentPrice, totalCost, currentValue, profitLoss, profitLossPercent };
        }).sort((a, b) => (b.currentValue ?? b.totalCost) - (a.currentValue ?? a.totalCost));
    }, [holdings, prices]);

    const { totalValue, totalCost, totalPL, totalPLPercent, hasPrices } = useMemo(() => {
        let val = 0, cost = 0;
        let anyPrice = false;
        for (const h of enrichedHoldings) {
            cost += h.totalCost;
            if (h.currentValue != null) {
                val += h.currentValue;
                anyPrice = true;
            }
        }
        const pl = anyPrice ? val - cost : null;
        return {
            totalValue: anyPrice ? val : null,
            totalCost: cost,
            totalPL: pl,
            totalPLPercent: cost > 0 && pl != null ? (pl / cost) * 100 : null,
            hasPrices: anyPrice,
        };
    }, [enrichedHoldings]);

    // ── Holdings grouped by market ─────────────────────────────────────
    const holdingsByMarket = useMemo(() => {
        const groups = {};
        for (const h of enrichedHoldings) {
            if (!groups[h.market]) groups[h.market] = [];
            groups[h.market].push(h);
        }
        // Sort by market order: bist, us, crypto, forex, commodity, fund
        const order = ['bist', 'us', 'crypto', 'forex', 'commodity', 'fund'];
        return order.filter(m => groups[m]).map(m => ({
            market: m,
            label: MARKET_LABELS[m] || m.toUpperCase(),
            holdings: groups[m],
            totalValue: groups[m].reduce((s, h) => s + (h.currentValue != null ? h.currentValue : 0), 0),
            hasAnyPrice: groups[m].some(h => h.currentValue != null),
        }));
    }, [enrichedHoldings]);

    const toggleGroup = useCallback((market) => {
        setExpandedGroups(prev => ({ ...prev, [market]: !prev[market] }));
    }, []);

    // ── Chart Data (real historical) ─────────────────────────────────────
    const [chartData, setChartData] = useState([]);
    const [chartLoading, setChartLoading] = useState(false);
    const chartAbortRef = useRef(null);

    const fetchPortfolioChart = useCallback(async () => {
        if (holdings.length === 0) { setChartData([]); return; }

        // Cancel previous fetch
        if (chartAbortRef.current) chartAbortRef.current.cancelled = true;
        const token = { cancelled: false };
        chartAbortRef.current = token;

        setChartLoading(true);
        const holdingsData = await Promise.all(
            holdings.map(async (h) => {
                const dataPoints = await fetchHoldingChart(h.market, h.symbol, timeRange);
                const purchaseTime = h.purchaseDate
                    ? new Date(h.purchaseDate).getTime()
                    : (h.addedAt ? new Date(h.addedAt).getTime() : null);
                return { quantity: h.quantity, dataPoints, purchaseTime };
            })
        );

        if (token.cancelled) return;

        const valid = holdingsData.filter(h => h.dataPoints.length > 0);
        const aggregated = aggregatePortfolioChart(valid);
        const labeled = aggregated.map(d => ({
            ...d,
            label: formatChartLabel(d.time, timeRange),
        }));

        setChartData(labeled);
        setChartLoading(false);
    }, [holdings, timeRange]);

    useEffect(() => { fetchPortfolioChart(); }, [fetchPortfolioChart]);

    const chartColor = useMemo(() => {
        if (chartData.length < 2) return '#3fb950';
        return chartData[chartData.length - 1].value >= chartData[0].value ? '#3fb950' : '#f85149';
    }, [chartData]);

    const chartChange = useMemo(() => {
        if (chartData.length < 2) return { value: totalPL ?? 0, percent: totalPLPercent ?? 0 };
        const first = chartData[0].value;
        const last = chartData[chartData.length - 1].value;
        const change = last - first;
        const pct = first > 0 ? (change / first) * 100 : 0;
        return { value: change, percent: pct };
    }, [chartData, totalPL, totalPLPercent]);

    // ── Allocation Data ─────────────────────────────────────────────────
    const allocationData = useMemo(() => {
        const groups = {};
        for (const h of enrichedHoldings) {
            if (!groups[h.market]) groups[h.market] = { market: h.market, value: 0 };
            if (h.currentValue != null) groups[h.market].value += h.currentValue;
        }
        const total = Object.values(groups).reduce((s, g) => s + g.value, 0);
        return Object.values(groups)
            .map(g => ({
                name: g.market === 'bist' ? 'BIST' : g.market === 'us' ? 'US Stocks' : g.market === 'forex' ? 'Forex' : g.market === 'commodity' ? 'Commodities' : g.market === 'fund' ? 'Funds/ETF' : 'Crypto',
                market: g.market,
                value: total > 0 ? parseFloat(((g.value / total) * 100).toFixed(1)) : 0,
                color: MARKET_COLORS[g.market] || '#8b949e',
            }))
            .sort((a, b) => b.value - a.value);
    }, [enrichedHoldings]);

    // ─── Empty State ────────────────────────────────────────────────────

    if (holdings.length === 0 && !showAddForm) {
        return (
            <div className="portfolio-page">
                <div className="portfolio-main">
                    <div className="empty-state">
                        <div className="empty-icon"><Plus size={48} /></div>
                        <h2>Build Your Portfolio</h2>
                        <p>Add your first asset to start tracking your investments in real time.</p>
                        <button className="btn-accent" onClick={() => setShowAddForm(true)}>
                            <Plus size={18} /> Add Asset
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Render ─────────────────────────────────────────────────────────

    return (
        <div className="portfolio-page">
            {/* ─── Left Column ─── */}
            <div className="portfolio-main">
                {/* Portfolio Summary Header */}
                <div className="section-header">
                    <h2 className="page-heading">Portfolio Summary</h2>
                </div>

                {/* Portfolio Value + Chart */}
                <div className="chart-card">
                    <div className="chart-card-top">
                        <div className="chart-info">
                            <span className="chart-label">Total Portfolio Value</span>
                            <span className="chart-total-value">
                                {hasPrices ? formatShort(totalValue) : <span className="chart-loading-text">Loading prices...</span>}
                            </span>
                            {hasPrices && (
                                <div className="chart-change-row">
                                    <span className={`chart-change ${chartChange.value >= 0 ? 'positive' : 'negative'}`}>
                                        {chartChange.value >= 0 ? '+' : ''}{formatShort(chartChange.value)}
                                    </span>
                                    <span className={`chart-change-pct ${chartChange.value >= 0 ? 'positive' : 'negative'}`}>
                                        {formatPercent(chartChange.percent)}
                                    </span>
                                    <span className="chart-range-label">{TIME_RANGE_LABELS[timeRange]}</span>
                                </div>
                            )}
                        </div>
                        <div className="time-tabs">
                            {TIME_RANGES.map(t => (
                                <button key={t}
                                    className={`time-tab ${timeRange === t ? 'active' : ''}`}
                                    onClick={() => setTimeRange(t)}
                                >{t}</button>
                            ))}
                        </div>
                    </div>
                    <div className="chart-area">
                        {chartLoading ? (
                            <div className="chart-loading">
                                <RefreshCw size={20} className="spin" />
                                <span>Loading chart...</span>
                            </div>
                        ) : chartData.length === 0 ? (
                            <div className="chart-loading">
                                <span>No chart data available</span>
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis
                                        dataKey="label" axisLine={false} tickLine={false}
                                        tick={{ fill: '#6e7681', fontSize: 11 }}
                                        interval="preserveStartEnd"
                                    />
                                    <Tooltip content={<ChartTooltip />} cursor={false} />
                                    <Area
                                        type="monotone" dataKey="value"
                                        stroke={chartColor} strokeWidth={2}
                                        fill="url(#portfolioGrad)"
                                        dot={false} activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Add Asset Button */}
                {!showAddForm && (
                    <button className="btn-accent add-btn" onClick={() => setShowAddForm(true)}>
                        <Plus size={16} /> Add Asset
                    </button>
                )}

                {/* Add Asset Form */}
                {showAddForm && (
                    <div className="add-form-card">
                        <div className="form-top">
                            <h3>Add Asset</h3>
                            <button className="icon-btn" onClick={() => { setShowAddForm(false); setFormError(''); }}><X size={18} /></button>
                        </div>
                        <form className="add-form" onSubmit={handleAddHolding}>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Market</label>
                                    <div className="market-pills">
                                        {MARKET_OPTIONS.map(opt => (
                                            <button type="button" key={opt.value}
                                                className={`market-pill ${formMarket === opt.value ? 'active' : ''}`}
                                                onClick={() => setFormMarket(opt.value)}
                                            >{opt.label}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="form-grid-4">
                                <div className="form-group">
                                    <label className="form-label">Symbol</label>
                                    <div className="symbol-autocomplete" ref={dropdownRef}>
                                        <input
                                            className="form-input"
                                            placeholder={formMarket === 'bist' ? 'THYAO' : formMarket === 'us' ? 'AAPL' : formMarket === 'forex' ? 'EURUSD=X' : formMarket === 'commodity' ? 'GC=F' : formMarket === 'fund' ? 'SPY' : 'BTC'}
                                            value={formSymbol}
                                            onChange={e => {
                                                setFormSymbol(e.target.value.toUpperCase());
                                                setShowDropdown(true);
                                                setHighlightIndex(-1);
                                            }}
                                            onFocus={() => setShowDropdown(true)}
                                            onKeyDown={handleSymbolKeyDown}
                                            ref={symbolInputRef}
                                            autoComplete="off"
                                            autoFocus
                                        />
                                        {showDropdown && (
                                            <div className="symbol-dropdown">
                                                {symbolsLoading ? (
                                                    <div className="symbol-loading">Loading symbols...</div>
                                                ) : filteredSymbols.length === 0 ? (
                                                    <div className="symbol-loading">No results found</div>
                                                ) : (
                                                    filteredSymbols.map((opt, i) => (
                                                        <div
                                                            key={opt.symbol}
                                                            className={`symbol-option${i === highlightIndex ? ' highlighted' : ''}`}
                                                            onMouseEnter={() => setHighlightIndex(i)}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault();
                                                                handleSymbolSelect(opt.symbol);
                                                            }}
                                                        >
                                                            <span className="symbol-ticker">{opt.symbol}</span>
                                                            <span className="symbol-name">{opt.name}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Quantity</label>
                                    <input className="form-input" type="number" placeholder="0" step="any" min="0"
                                        value={formQuantity} onChange={e => setFormQuantity(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Purchase Price</label>
                                    <input className="form-input" type="number" placeholder="0.00" step="any" min="0"
                                        value={formPrice} onChange={e => setFormPrice(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Purchase Date</label>
                                    <input className="form-input" type="date"
                                        value={formDate}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setFormDate(e.target.value)} />
                                </div>
                            </div>
                            {formError && <p className="form-error">{formError}</p>}
                            <div className="form-actions">
                                <button type="button" className="btn-ghost" onClick={() => { setShowAddForm(false); setFormError(''); }}>Cancel</button>
                                <button type="submit" className="btn-accent"><Plus size={16} /> Add to Portfolio</button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Holdings Header */}
                <div className="section-header">
                    <h3 className="section-heading">Assets</h3>
                    <button className="icon-btn" onClick={refreshPrices} disabled={loadingPrices} title="Refresh">
                        <RefreshCw size={16} className={loadingPrices ? 'spin' : ''} />
                    </button>
                </div>

                {/* Asset Distribution */}
                {allocationData.length > 0 && (
                    <div className="distribution-card">
                        <div className="distribution-chart">
                            <ResponsiveContainer width={140} height={140}>
                                <PieChart>
                                    <Pie data={allocationData} cx="50%" cy="50%"
                                        innerRadius={40} outerRadius={65} paddingAngle={2}
                                        dataKey="value" activeIndex={activeIndex}
                                        activeShape={renderActiveShape}
                                        onMouseEnter={(_, i) => setActiveIndex(i)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                        animationDuration={400} style={{ cursor: 'pointer' }}
                                    >
                                        {allocationData.map((e, i) => (
                                            <Cell key={i} fill={e.color}
                                                opacity={activeIndex !== null && activeIndex !== i ? 0.4 : 1} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="distribution-info">
                            <h4 className="distribution-title">Asset Allocation</h4>
                            <div className="distribution-legend">
                                {allocationData.map((cat, i) => (
                                    <div key={cat.name} className="legend-row"
                                        onMouseEnter={() => setActiveIndex(i)}
                                        onMouseLeave={() => setActiveIndex(null)}
                                    >
                                        <span className="legend-dot" style={{ background: cat.color }} />
                                        <span className="legend-label">{cat.name}</span>
                                        <span className="legend-pct">{cat.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Holdings by Market — Collapsible Groups */}
                {holdingsByMarket.map((group) => (
                    <div key={group.market} className="holdings-group">
                        <button
                            className="holdings-group-header"
                            onClick={() => toggleGroup(group.market)}
                        >
                            <div className="group-header-left">
                                {expandedGroups[group.market]
                                    ? <ChevronDown size={16} />
                                    : <ChevronRight size={16} />
                                }
                                <span className="group-color-dot" style={{ background: MARKET_COLORS[group.market] }} />
                                <span className="group-label">{group.label}</span>
                                <span className="group-count">{group.holdings.length}</span>
                            </div>
                            <span className="group-total">{group.hasAnyPrice ? formatCurrency(group.totalValue, group.market) : '—'}</span>
                        </button>

                        {expandedGroups[group.market] && (
                            <div className="holdings-group-body">
                                {group.holdings.map((h) => (
                                    <div key={h.id} className="holding-row" onClick={() => navigate(`/asset/${h.market}/${h.symbol}`)}>
                                        <div className="holding-avatar" style={{ background: MARKET_COLORS[h.market] }}>
                                            {h.symbol.charAt(0)}
                                        </div>
                                        <div className="holding-main">
                                            <span className="holding-symbol">{h.symbol}</span>
                                            <span className="holding-name">{h.name}</span>
                                            {h.purchaseDate && (
                                                <span className="holding-date">
                                                    {new Date(h.purchaseDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="holding-stats">
                                            <div className="holding-stat">
                                                <span className="holding-stat-label">Qty</span>
                                                <span className="holding-stat-value">{formatQuantity(h.quantity)}</span>
                                            </div>
                                            <div className="holding-stat">
                                                <span className="holding-stat-label">Avg. Cost</span>
                                                <span className="holding-stat-value">{formatCurrency(h.avgCost, h.market)}</span>
                                            </div>
                                            {h.currentPrice != null && (
                                                <div className="holding-stat">
                                                    <span className="holding-stat-label">Value</span>
                                                    <span className="holding-stat-value">{formatCurrency(h.currentValue, h.market)}</span>
                                                </div>
                                            )}
                                            {h.profitLoss != null && (
                                                <div className="holding-stat">
                                                    <span className="holding-stat-label">P/L</span>
                                                    <span className={`holding-stat-value ${h.profitLoss >= 0 ? 'positive' : 'negative'}`}>
                                                        {h.profitLoss >= 0 ? '+' : ''}{formatCurrency(h.profitLoss, h.market)}
                                                        <small> ({formatPercent(h.profitLossPercent)})</small>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="holding-delete" onClick={e => e.stopPropagation()}>
                                            {deleteConfirm === h.id ? (
                                                <>
                                                    <button className="confirm-del" onClick={() => handleDelete(h.id)}>Del</button>
                                                    <button className="icon-btn-sm" onClick={() => setDeleteConfirm(null)}><X size={12} /></button>
                                                </>
                                            ) : (
                                                <button className="icon-btn-sm" onClick={() => setDeleteConfirm(h.id)} title="Remove">
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* ─── Right Column — Favorites ─── */}
            <aside className="portfolio-sidebar">
                {/* ── Favorites Panel ── */}
                <div className="favorites-panel">
                    <div className="favorites-header">
                        <h3 className="favorites-title"><Star size={16} /> Favorites</h3>
                        <button className="icon-btn" onClick={() => setShowAddFav(prev => !prev)} title="Add Favorite">
                            <Plus size={16} />
                        </button>
                    </div>

                    {showAddFav && (
                        <div className="fav-add-row">
                            <div className="fav-market-pills">
                                {MARKET_OPTIONS.map(opt => (
                                    <button type="button" key={opt.value}
                                        className={`fav-market-pill ${favMarket === opt.value ? 'active' : ''}`}
                                        onClick={() => { setFavMarket(opt.value); setFavSymbol(''); }}
                                    >{opt.label}</button>
                                ))}
                            </div>
                            <div className="fav-symbol-input" ref={favDropdownRef}>
                                <input
                                    className="form-input"
                                    placeholder="Search symbol..."
                                    value={favSymbol}
                                    onChange={e => { setFavSymbol(e.target.value.toUpperCase()); setShowFavDropdown(true); setFavHighlight(-1); }}
                                    onFocus={() => setShowFavDropdown(true)}
                                    onKeyDown={e => {
                                        if (e.key === 'ArrowDown') { e.preventDefault(); setFavHighlight(p => (p + 1) % filteredFavSymbols.length); }
                                        else if (e.key === 'ArrowUp') { e.preventDefault(); setFavHighlight(p => (p - 1 + filteredFavSymbols.length) % filteredFavSymbols.length); }
                                        else if (e.key === 'Enter' && favHighlight >= 0) { e.preventDefault(); handleAddFavorite(filteredFavSymbols[favHighlight].symbol); }
                                        else if (e.key === 'Escape') setShowFavDropdown(false);
                                    }}
                                    autoComplete="off"
                                />
                                {showFavDropdown && (
                                    <div className="symbol-dropdown">
                                        {favSymbolsLoading ? (
                                            <div className="symbol-loading">Loading...</div>
                                        ) : filteredFavSymbols.length === 0 ? (
                                            <div className="symbol-loading">No results found</div>
                                        ) : (
                                            filteredFavSymbols.map((opt, i) => (
                                                <div key={opt.symbol}
                                                    className={`symbol-option${i === favHighlight ? ' highlighted' : ''}`}
                                                    onMouseEnter={() => setFavHighlight(i)}
                                                    onMouseDown={e => { e.preventDefault(); handleAddFavorite(opt.symbol); }}
                                                >
                                                    <span className="symbol-ticker">{opt.symbol}</span>
                                                    <span className="symbol-name">{opt.name}</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="favorites-list">
                        {favorites.length === 0 ? (
                            <div className="favorites-empty">
                                Click <Plus size={12} /> to add favorites
                            </div>
                        ) : (
                            favorites.map(fav => {
                                const priceData = favPrices[`${fav.market}:${fav.symbol}`] || prices[`${fav.market}:${fav.symbol}`];
                                const change = priceData?.change;
                                const isUp = change != null && change >= 0;
                                return (
                                    <div key={`${fav.market}:${fav.symbol}`} className="fav-row"
                                        onClick={() => navigate(`/asset/${fav.market}/${fav.symbol}`)}
                                    >
                                        <div className="fav-avatar" style={{ background: MARKET_COLORS[fav.market] }}>
                                            {fav.symbol.charAt(0)}
                                        </div>
                                        <div className="fav-info">
                                            <span className="fav-symbol">{fav.symbol}</span>
                                            <span className="fav-market-label">{MARKET_LABELS[fav.market]}</span>
                                        </div>
                                        <div className="fav-price-col">
                                            {priceData ? (
                                                <>
                                                    <span className="fav-price">{formatCurrency(priceData.price, fav.market)}</span>
                                                    <span className={`fav-change ${isUp ? 'positive' : 'negative'}`}>
                                                        {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                                        {formatPercent(change)}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="fav-price-loading">—</span>
                                            )}
                                        </div>
                                        <button className="fav-remove" onClick={e => { e.stopPropagation(); handleRemoveFavorite(fav.symbol, fav.market); }}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </aside>
        </div>
    );
}
