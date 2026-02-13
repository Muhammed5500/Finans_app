import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    MessageCircle,
    ExternalLink,
    Info,
    BarChart3,
    RefreshCw,
    Newspaper,
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '../components/Skeleton';
import './AssetDetail.css';

// ─── Time Range Config ──────────────────────────────────────────────────────

const TIME_RANGES = ['1D', '7D', '30D', '90D', '1Y'];

const YAHOO_CHART_RANGE = {
    '1D':  { interval: '5m',  rangeDays: '1',   range: '1d' },
    '7D':  { interval: '1h',  rangeDays: '7',   range: '5d' },
    '30D': { interval: '1h',  rangeDays: '30',  range: '1mo' },
    '90D': { interval: '1d',  rangeDays: '90',  range: '3mo' },
    '1Y':  { interval: '1d',  rangeDays: '365', range: '1y' },
};

const CHART_PARAMS = {
    crypto: {
        '1D':  { interval: '15m', limit: 96 },
        '7D':  { interval: '1h',  limit: 168 },
        '30D': { interval: '4h',  limit: 180 },
        '90D': { interval: '1d',  limit: 90 },
        '1Y':  { interval: '1d',  limit: 365 },
    },
    bist: {
        '1D':  { interval: '5m',  range: '1d' },
        '7D':  { interval: '1h',  range: '5d' },
        '30D': { interval: '1h',  range: '1mo' },
        '90D': { interval: '1d',  range: '3mo' },
        '1Y':  { interval: '1d',  range: '1y' },
    },
    us: YAHOO_CHART_RANGE,
    forex: YAHOO_CHART_RANGE,
    commodity: YAHOO_CHART_RANGE,
    fund: YAHOO_CHART_RANGE,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatLargeNumber(num) {
    if (num == null) return '—';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9)  return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6)  return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString('en-US')}`;
}

function formatPrice(price, market) {
    if (price == null) return '—';
    if (market === 'bist') {
        return `₺${Number(price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    if (market === 'forex') {
        return Number(price).toFixed(4);
    }
    if (market === 'crypto' && price < 1) {
        return `$${Number(price).toFixed(6)}`;
    }
    if (market === 'crypto' && price < 100) {
        return `$${Number(price).toFixed(4)}`;
    }
    return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(val) {
    if (val == null) return '—';
    return `${val >= 0 ? '+' : ''}${Number(val).toFixed(2)}%`;
}

function formatStat(val, suffix = '') {
    if (val == null || val === undefined) return '—';
    return `${Number(val).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
}

function formatChartTime(isoString, rangeKey) {
    const d = new Date(isoString);
    if (rangeKey === '1D') return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    if (rangeKey === '7D') return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Data Fetching ──────────────────────────────────────────────────────────

function buildDetailUrl(market, symbol) {
    if (market === 'crypto') return `/api/crypto/detail?symbol=${encodeURIComponent(symbol)}`;
    if (market === 'bist')   return `/api/bist/detail?symbol=${encodeURIComponent(symbol)}`;
    // us, forex, commodity, fund all use Yahoo via the US endpoint (no BIST validation)
    if (market === 'us' || market === 'forex' || market === 'commodity' || market === 'fund')
        return `/api/us/detail?symbol=${encodeURIComponent(symbol)}`;
    return null;
}

function buildChartUrl(market, symbol, rangeKey) {
    const p = CHART_PARAMS[market]?.[rangeKey];
    if (!p) return null;

    if (market === 'crypto') {
        return `/api/crypto/klines?symbol=${encodeURIComponent(symbol)}&interval=${p.interval}&limit=${p.limit}`;
    }
    if (market === 'bist') {
        return `/api/bist/chart?symbol=${encodeURIComponent(symbol)}&interval=${p.interval}&range=${p.range}`;
    }
    if (market === 'us' || market === 'forex' || market === 'commodity' || market === 'fund') {
        return `/api/us/chart?symbol=${encodeURIComponent(symbol)}&interval=${p.interval}&rangeDays=${p.rangeDays}`;
    }
    return null;
}

function normalizeChartData(market, json, rangeKey) {
    if (!json?.ok) return [];

    if (market === 'crypto') {
        // Klines: result.data is array of [openTime, open, high, low, close, ...]
        const klines = json.result?.data;
        if (!Array.isArray(klines)) return [];
        return klines.map(k => ({
            time: formatChartTime(new Date(k[0]).toISOString(), rangeKey),
            value: parseFloat(k[4]), // close price
        }));
    }

    if (market === 'bist') {
        const candles = json.result?.candles;
        if (!Array.isArray(candles)) return [];
        return candles.map(c => ({
            time: formatChartTime(c.time, rangeKey),
            value: c.close,
        }));
    }

    if (market === 'us' || market === 'forex' || market === 'commodity' || market === 'fund') {
        const candles = json.result?.candles;
        if (!Array.isArray(candles)) return [];
        return candles.map(c => ({
            time: formatChartTime(c.time, rangeKey),
            value: c.close,
        }));
    }

    return [];
}

function buildNewsUrl(market) {
    const categoryMap = { crypto: 'crypto', bist: 'bist', us: 'us', forex: 'us', commodity: 'us', fund: 'us' };
    const category = categoryMap[market] || 'us';
    return `/api/news?category=${category}&limit=5`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AssetDetail() {
    const { market, symbol } = useParams();
    const navigate = useNavigate();

    const [detail, setDetail] = useState(null);
    const [chartData, setChartData] = useState([]);
    const [newsItems, setNewsItems] = useState([]);
    const [selectedRange, setSelectedRange] = useState('30D');

    const [loadingDetail, setLoadingDetail] = useState(true);
    const [loadingChart, setLoadingChart] = useState(true);
    const [loadingNews, setLoadingNews] = useState(true);
    const [errorDetail, setErrorDetail] = useState(null);
    const [errorChart, setErrorChart] = useState(null);

    const marketLower = (market || 'crypto').toLowerCase();
    const symbolUpper = (symbol || '').toUpperCase();

    // ── Fetch Detail ─────────────────────────────────────────────────────
    const fetchDetail = useCallback(async () => {
        setLoadingDetail(true);
        setErrorDetail(null);
        try {
            const url = buildDetailUrl(marketLower, symbolUpper);
            if (!url) throw new Error('Unknown market');
            const res = await fetch(url);
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || 'Detail fetch failed');
            setDetail(json.result);
        } catch (err) {
            setErrorDetail(err.message);
        } finally {
            setLoadingDetail(false);
        }
    }, [marketLower, symbolUpper]);

    // ── Fetch Chart ──────────────────────────────────────────────────────
    const fetchChart = useCallback(async (rangeKey) => {
        setLoadingChart(true);
        setErrorChart(null);
        try {
            const url = buildChartUrl(marketLower, symbolUpper, rangeKey);
            if (!url) throw new Error('Unknown market/range');
            const res = await fetch(url);
            const json = await res.json();
            const data = normalizeChartData(marketLower, json, rangeKey);
            setChartData(data);
            if (data.length === 0) setErrorChart('No chart data available');
        } catch (err) {
            setErrorChart(err.message);
            setChartData([]);
        } finally {
            setLoadingChart(false);
        }
    }, [marketLower, symbolUpper]);

    // ── Fetch News ───────────────────────────────────────────────────────
    const fetchNews = useCallback(async () => {
        setLoadingNews(true);
        try {
            const url = buildNewsUrl(marketLower);
            const res = await fetch(url);
            const json = await res.json();
            if (json.ok && Array.isArray(json.result?.data)) {
                setNewsItems(json.result.data);
            } else if (Array.isArray(json.data)) {
                setNewsItems(json.data);
            }
        } catch {
            // News is non-critical, silently fail
        } finally {
            setLoadingNews(false);
        }
    }, [marketLower]);

    // ── Effects ──────────────────────────────────────────────────────────
    useEffect(() => {
        fetchDetail();
        fetchNews();
    }, [fetchDetail, fetchNews]);

    useEffect(() => {
        fetchChart(selectedRange);
    }, [fetchChart, selectedRange]);

    // ── Derived values ───────────────────────────────────────────────────
    const price = detail?.price ?? detail?.regularMarketPrice ?? null;
    const changePercent = detail?.changePercent ?? detail?.regularMarketChangePercent ?? null;
    const change = detail?.change ?? detail?.regularMarketChange ?? null;
    const isPositive = (changePercent ?? 0) >= 0;
    const displayName = detail?.name || detail?.displayName || detail?.shortName || symbolUpper;
    const description = detail?.description || detail?.longBusinessSummary || null;

    const chartColor = isPositive ? '#3fb950' : '#f85149';

    const getMarketLabel = () => {
        if (marketLower === 'crypto') return 'Cryptocurrency';
        if (marketLower === 'bist') return 'BIST';
        if (marketLower === 'us') return 'US Stock';
        if (marketLower === 'forex') return 'Forex';
        if (marketLower === 'commodity') return 'Commodity';
        if (marketLower === 'fund') return 'Fund/ETF';
        return marketLower.toUpperCase();
    };

    // ── Stats Cards ──────────────────────────────────────────────────────
    const statsCards = useMemo(() => {
        if (!detail) return [];

        if (marketLower === 'crypto') {
            return [
                { label: '24h Volume', value: detail.volume24h != null ? formatLargeNumber(detail.volume24h) : '—' },
                { label: '24h High', value: formatPrice(detail.high24h, 'crypto') },
                { label: '24h Low', value: formatPrice(detail.low24h, 'crypto') },
                { label: '24h Change', value: formatPercent(detail.changePercent), color: (detail.changePercent ?? 0) >= 0 ? 'positive' : 'negative' },
                { label: 'Quote Volume', value: detail.quoteVolume24h != null ? formatLargeNumber(detail.quoteVolume24h) : '—' },
                { label: 'Exchange', value: detail.exchange || 'Binance' },
            ];
        }

        if (marketLower === 'bist') {
            return [
                { label: 'Market Cap', value: detail.marketCap != null ? formatLargeNumber(detail.marketCap) : '—' },
                { label: 'P/E Ratio', value: formatStat(detail.peRatio) },
                { label: '52W High', value: formatPrice(detail.fiftyTwoWeekHigh, 'bist') },
                { label: '52W Low', value: formatPrice(detail.fiftyTwoWeekLow, 'bist') },
                { label: 'Dividend Yield', value: detail.dividendYield != null ? formatStat(detail.dividendYield * 100, '%') : '—' },
                { label: 'Beta', value: formatStat(detail.beta) },
            ];
        }

        if (marketLower === 'forex') {
            return [
                { label: '52W High', value: formatPrice(detail.fiftyTwoWeekHigh, 'forex') },
                { label: '52W Low', value: formatPrice(detail.fiftyTwoWeekLow, 'forex') },
                { label: '50D Average', value: formatPrice(detail.fiftyDayAverage, 'forex') },
                { label: '200D Average', value: formatPrice(detail.twoHundredDayAverage, 'forex') },
            ];
        }

        // US, commodity, fund
        return [
            { label: 'Market Cap', value: detail.marketCap != null ? formatLargeNumber(detail.marketCap) : '—' },
            { label: 'P/E Ratio', value: formatStat(detail.peRatio) },
            { label: 'Forward P/E', value: formatStat(detail.forwardPE) },
            { label: '52W High', value: formatPrice(detail.fiftyTwoWeekHigh, marketLower) },
            { label: '52W Low', value: formatPrice(detail.fiftyTwoWeekLow, marketLower) },
            { label: 'Dividend Yield', value: detail.dividendYield != null ? formatStat(detail.dividendYield * 100, '%') : '—' },
            { label: 'Beta', value: formatStat(detail.beta) },
            { label: 'Price/Book', value: formatStat(detail.priceToBook) },
        ];
    }, [detail, marketLower]);

    // ── Render: Error State ──────────────────────────────────────────────
    if (!loadingDetail && errorDetail) {
        return (
            <div className="asset-detail-page">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} />
                    <span>Back</span>
                </button>
                <div className="detail-error-state">
                    <Info size={48} />
                    <h2>{symbolUpper}</h2>
                    <p>{errorDetail}</p>
                    <button className="retry-btn" onClick={fetchDetail}>
                        <RefreshCw size={16} />
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: Loading Skeleton ─────────────────────────────────────────
    if (loadingDetail && !detail) {
        return (
            <div className="asset-detail-page">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ArrowLeft size={18} />
                    <span>Back</span>
                </button>
                <div className="detail-skeleton">
                    <div className="skeleton-header">
                        <Skeleton width="40%" height={32} />
                        <Skeleton width="25%" height={18} />
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <Skeleton width={120} height={36} />
                            <Skeleton width={80} height={36} />
                        </div>
                    </div>
                    <Skeleton width="100%" height={300} borderRadius="12px" />
                    <div className="skeleton-stats">
                        {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="skeleton-stat-card">
                                <Skeleton width="60%" height={12} />
                                <Skeleton width="80%" height={20} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Render: Main ─────────────────────────────────────────────────────
    return (
        <div className="asset-detail-page">
            {/* Back Navigation */}
            <button className="back-btn" onClick={() => navigate(-1)}>
                <ArrowLeft size={18} />
                <span>Back</span>
            </button>

            {/* Header */}
            <header className="asset-header fade-in">
                <div className="header-left">
                    <div className="asset-identity">
                        <h1 className="asset-title">
                            <span className="asset-symbol-lg">{symbolUpper}</span>
                            <span className="asset-name-lg">{displayName}</span>
                        </h1>
                        <span className={`market-badge ${marketLower}`}>
                            {getMarketLabel()}
                        </span>
                    </div>

                    <div className="price-section">
                        <span className="current-price">{formatPrice(price, marketLower)}</span>
                        {change != null && (
                            <span className={`price-change ${isPositive ? 'positive' : 'negative'}`}>
                                {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                {isPositive ? '+' : ''}{formatPrice(Math.abs(change), marketLower)}
                                ({formatPercent(changePercent)})
                            </span>
                        )}
                    </div>
                </div>

            </header>

            {/* Price Chart */}
            <section className="chart-section fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="chart-header">
                    <h2 className="section-label">
                        <BarChart3 size={18} />
                        Price History
                    </h2>
                    <div className="time-selector">
                        {TIME_RANGES.map(range => (
                            <button
                                key={range}
                                className={`time-btn ${selectedRange === range ? 'active' : ''}`}
                                onClick={() => setSelectedRange(range)}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="chart-container">
                    {loadingChart ? (
                        <div className="chart-loading">
                            <Skeleton width="100%" height={280} borderRadius="8px" />
                        </div>
                    ) : errorChart && chartData.length === 0 ? (
                        <div className="chart-error">
                            <p>{errorChart}</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={chartColor} stopOpacity={0.2} />
                                        <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis
                                    dataKey="time"
                                    stroke="#6e7681"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                    minTickGap={40}
                                />
                                <YAxis
                                    stroke="#6e7681"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    domain={['auto', 'auto']}
                                    tickFormatter={(v) => formatPrice(v, marketLower)}
                                    width={80}
                                />
                                <Tooltip
                                    contentStyle={{
                                        background: '#21262d',
                                        border: '1px solid #30363d',
                                        borderRadius: '8px',
                                        color: '#e6edf3',
                                        fontSize: '13px',
                                    }}
                                    formatter={(value) => [formatPrice(value, marketLower), 'Price']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={chartColor}
                                    strokeWidth={2}
                                    fill="url(#priceGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </section>

            {/* Stats Grid */}
            {statsCards.length > 0 && (
                <section className="stats-section fade-in" style={{ animationDelay: '0.15s' }}>
                    <h2 className="section-label">Market Statistics</h2>
                    <div className="stats-grid">
                        {statsCards.map((stat) => (
                            <div key={stat.label} className="stat-card">
                                <span className="stat-label">{stat.label}</span>
                                <span className={`stat-value ${stat.color || ''}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* About Section */}
            {(description || detail?.sector) && (
                <section className="about-section fade-in" style={{ animationDelay: '0.2s' }}>
                    <h2 className="section-label">
                        <Info size={18} />
                        About {displayName}
                    </h2>
                    <div className="about-content">
                        {detail?.sector && (
                            <div className="about-meta">
                                {detail.sector && <span className="meta-tag">{detail.sector}</span>}
                                {detail.industry && <span className="meta-tag">{detail.industry}</span>}
                                {detail.headquarters && <span className="meta-tag">{detail.headquarters}</span>}
                                {detail.employees && <span className="meta-tag">{Number(detail.employees).toLocaleString()} employees</span>}
                            </div>
                        )}
                        {description && <p className="description">{description}</p>}
                        {detail?.website && (
                            <a
                                href={detail.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="website-link"
                            >
                                {detail.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                <ExternalLink size={14} />
                            </a>
                        )}
                        {detail?.paysDividend && (
                            <div className="dividend-info">
                                <span className="dividend-label">Dividend</span>
                                <span className="dividend-value">
                                    {detail.dividendRate != null ? `$${detail.dividendRate.toFixed(2)}/year` : ''}
                                    {detail.dividendYield != null ? ` (${(detail.dividendYield * 100).toFixed(2)}% yield)` : ''}
                                </span>
                            </div>
                        )}
                        {marketLower === 'crypto' && (
                            <div className="dividend-info">
                                <span className="dividend-label">Dividends</span>
                                <span className="dividend-value">Kripto paralar temettü ödemez</span>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* News Section */}
            {newsItems.length > 0 && (
                <section className="news-section fade-in" style={{ animationDelay: '0.25s' }}>
                    <h2 className="section-label">
                        <Newspaper size={18} />
                        Related News
                    </h2>
                    <div className="news-list">
                        {newsItems.map((item, i) => (
                            <a
                                key={item.id || i}
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="news-item"
                            >
                                <span className="news-title">{item.title}</span>
                                <span className="news-meta">
                                    {item.source && <span className="news-source">{item.source}</span>}
                                    {item.publishedAt && (
                                        <span className="news-time">
                                            {new Date(item.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                    )}
                                </span>
                            </a>
                        ))}
                    </div>
                </section>
            )}

            {/* AI Section */}
            <section className="ai-section fade-in" style={{ animationDelay: '0.3s' }}>
                <div className="ai-card">
                    <div className="ai-content">
                        <MessageCircle size={24} />
                        <div className="ai-text">
                            <h3>Want to learn more?</h3>
                            <p>Ask our AI assistant about {displayName} in simple terms.</p>
                        </div>
                    </div>
                    <button
                        className="ai-btn"
                        onClick={() => {
                            window.dispatchEvent(new CustomEvent('openAIChat', {
                                detail: { query: `Tell me more about ${displayName} (${symbolUpper}). What should investors know?` }
                            }));
                        }}
                    >
                        Ask AI about {symbolUpper}
                        <ExternalLink size={16} />
                    </button>
                </div>
            </section>
        </div>
    );
}
