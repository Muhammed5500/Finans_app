import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { SkeletonTableRow } from '../components/Skeleton';
import './Markets.css';

// Crypto category map (100 symbols)
const CRYPTO_CATEGORIES = {
    // Layer 1
    BTC: 'Layer 1', ETH: 'Layer 1', SOL: 'Layer 1', ADA: 'Layer 1', AVAX: 'Layer 1',
    DOT: 'Layer 1', NEAR: 'Layer 1', APT: 'Layer 1', SUI: 'Layer 1', SEI: 'Layer 1',
    TON: 'Layer 1', TRX: 'Layer 1', BCH: 'Layer 1', ETC: 'Layer 1', XLM: 'Layer 1',
    ALGO: 'Layer 1', HBAR: 'Layer 1', ICP: 'Layer 1', EGLD: 'Layer 1', FTM: 'Layer 1',
    FLOW: 'Layer 1', XTZ: 'Layer 1', EOS: 'Layer 1', NEO: 'Layer 1', KAS: 'Layer 1',
    IOTA: 'Layer 1', ONE: 'Layer 1', CELO: 'Layer 1', ZIL: 'Layer 1', ASTR: 'Layer 1',
    MINA: 'Layer 1', CKB: 'Layer 1',
    // DeFi
    LINK: 'DeFi', UNI: 'DeFi', AAVE: 'DeFi', MKR: 'DeFi', SNX: 'DeFi', COMP: 'DeFi',
    CRV: 'DeFi', LDO: 'DeFi', RPL: 'DeFi', DYDX: 'DeFi', SUSHI: 'DeFi', BAL: 'DeFi',
    YFI: 'DeFi', '1INCH': 'DeFi', PENDLE: 'DeFi', JTO: 'DeFi', JUP: 'DeFi',
    KAVA: 'DeFi', OSMO: 'DeFi', RUNE: 'DeFi', ATOM: 'DeFi', INJ: 'DeFi',
    // AI
    FET: 'AI', RNDR: 'AI', OCEAN: 'AI', AGIX: 'AI', AKT: 'AI',
    // Gaming & Metaverse
    IMX: 'Gaming', AXS: 'Gaming', SAND: 'Gaming', MANA: 'Gaming', ENJ: 'Gaming',
    GALA: 'Gaming',
    // Meme
    DOGE: 'Meme', SHIB: 'Meme', PEPE: 'Meme', WIF: 'Meme', BONK: 'Meme', FLOKI: 'Meme',
    APE: 'Meme',
    // L2
    ARB: 'L2', OP: 'L2', MATIC: 'L2', STX: 'L2', MANTA: 'L2', ZK: 'L2', STRK: 'L2',
    // Infrastructure
    GRT: 'Infrastructure', FIL: 'Infrastructure', THETA: 'Infrastructure', QNT: 'Infrastructure',
    ANKR: 'Infrastructure', BAND: 'Infrastructure', PYTH: 'Infrastructure', ENS: 'Infrastructure',
    CHZ: 'Infrastructure', ROSE: 'Infrastructure', CFX: 'Infrastructure', VET: 'Infrastructure',
    // Exchange
    BNB: 'Exchange', LTC: 'Exchange',
    // Privacy
    ZEC: 'Privacy', DASH: 'Privacy',
    // Social
    MASK: 'Social', BLUR: 'Social',
    // Other
    XRP: 'Payment', WLD: 'Identity', TIA: 'Modular', W: 'Bridge',
};

// BIST sector categories (full BIST 100 coverage)
const BIST_CATEGORIES = {
    // Banking
    AKBNK: 'Banking', GARAN: 'Banking', HALKB: 'Banking', ISCTR: 'Banking',
    SKBNK: 'Banking', VAKBN: 'Banking', YKBNK: 'Banking',
    // Holding
    AGHOL: 'Holding', DOHOL: 'Holding', KCHOL: 'Holding', SAHOL: 'Holding',
    EKGYO: 'Holding', ISGYO: 'Holding', ISMEN: 'Holding',
    // Industrial
    ARCLK: 'Industrial', CEMTS: 'Industrial', CIMSA: 'Industrial', EREGL: 'Industrial',
    FROTO: 'Industrial', OTKAR: 'Industrial', SASA: 'Industrial', TOASO: 'Industrial',
    TTRAK: 'Industrial', VESTL: 'Industrial', VESBE: 'Industrial', BUCIM: 'Industrial',
    BRYAT: 'Industrial', DOAS: 'Industrial', KRDMD: 'Industrial', SARKY: 'Industrial',
    SMRTG: 'Industrial',
    // Energy
    AKSA: 'Energy', AKSEN: 'Energy', CWENE: 'Energy', ENJSA: 'Energy',
    EUPWR: 'Energy', ODAS: 'Energy', PETKM: 'Energy', TUPRS: 'Energy', ZOREN: 'Energy',
    // Consumer
    AEFES: 'Consumer', BIMAS: 'Consumer', CCOLA: 'Consumer', MAVI: 'Consumer',
    MGROS: 'Consumer', SOKM: 'Consumer', ULKER: 'Consumer', YATAS: 'Consumer',
    SELEC: 'Consumer', TKNSA: 'Consumer', TUKAS: 'Consumer',
    // Defense
    ASELS: 'Defense', ASTOR: 'Defense',
    // Aviation
    PGSUS: 'Aviation', TAVHL: 'Aviation', THYAO: 'Aviation',
    // Telecom
    TCELL: 'Telecom', TTKOM: 'Telecom', TURSG: 'Telecom',
    // Mining
    KOZAA: 'Mining', KOZAL: 'Mining',
    // Technology
    ALFAS: 'Technology', ARDYZ: 'Technology', TMSN: 'Technology',
    // Other
    AKCNS: 'Chemicals', AKFGY: 'Chemicals', BERA: 'Consumer', BIOEN: 'Healthcare',
    CANTE: 'Consumer', ECILC: 'Chemicals', EGEEN: 'Industrial', ENKAI: 'Industrial',
    EUREN: 'Chemicals', GESAN: 'Energy', GUBRF: 'Chemicals', HEKTS: 'Chemicals',
    KERVT: 'Consumer', KLSER: 'Industrial', KONTR: 'Industrial', KONYA: 'Industrial',
    MPARK: 'Consumer', OYAKC: 'Industrial',
};

// US sector categories (full S&P 500 representative coverage)
const US_CATEGORIES = {
    // Technology
    AAPL: 'Technology', MSFT: 'Technology', GOOGL: 'Technology', GOOG: 'Technology',
    NVDA: 'Technology', META: 'Technology', AVGO: 'Technology', ORCL: 'Technology',
    CRM: 'Technology', AMD: 'Technology', ADBE: 'Technology', INTC: 'Technology',
    CSCO: 'Technology', QCOM: 'Technology', INTU: 'Technology', IBM: 'Technology',
    AMAT: 'Technology', NOW: 'Technology', TXN: 'Technology', MU: 'Technology',
    LRCX: 'Technology', KLAC: 'Technology', SNPS: 'Technology', CDNS: 'Technology',
    PANW: 'Technology', PLTR: 'Technology',
    // Communication
    NFLX: 'Communication', DIS: 'Communication', CMCSA: 'Communication',
    TMUS: 'Communication', VZ: 'Communication', T: 'Communication',
    // Finance
    JPM: 'Finance', V: 'Finance', MA: 'Finance', BAC: 'Finance', WFC: 'Finance',
    GS: 'Finance', MS: 'Finance', BLK: 'Finance', SCHW: 'Finance', AXP: 'Finance',
    C: 'Finance', SPGI: 'Finance', CB: 'Finance', BX: 'Finance',
    // Healthcare
    UNH: 'Healthcare', JNJ: 'Healthcare', LLY: 'Healthcare', ABBV: 'Healthcare',
    MRK: 'Healthcare', PFE: 'Healthcare', TMO: 'Healthcare', ABT: 'Healthcare',
    DHR: 'Healthcare', BMY: 'Healthcare', AMGN: 'Healthcare', GILD: 'Healthcare',
    ISRG: 'Healthcare', VRTX: 'Healthcare', MDT: 'Healthcare',
    // Consumer
    AMZN: 'Consumer', TSLA: 'Consumer', WMT: 'Consumer', PG: 'Consumer',
    KO: 'Consumer', PEP: 'Consumer', COST: 'Consumer', HD: 'Consumer',
    MCD: 'Consumer', NKE: 'Consumer', SBUX: 'Consumer', TGT: 'Consumer',
    LOW: 'Consumer', CL: 'Consumer',
    // Industrial
    CAT: 'Industrial', GE: 'Industrial', RTX: 'Industrial', HON: 'Industrial',
    UNP: 'Industrial', BA: 'Industrial', DE: 'Industrial', LMT: 'Industrial',
    UPS: 'Industrial', MMM: 'Industrial',
    // Energy
    XOM: 'Energy', CVX: 'Energy', COP: 'Energy', SLB: 'Energy', EOG: 'Energy',
    // Utilities & REIT
    NEE: 'Utilities', SO: 'Utilities', DUK: 'Utilities',
    AMT: 'REIT', PLD: 'REIT',
    // Materials
    LIN: 'Materials', APD: 'Materials', FCX: 'Materials',
};

// Forex category map
const FOREX_CATEGORIES = {
    'USDTRY=X': 'TRY Pairs', 'EURTRY=X': 'TRY Pairs', 'GBPTRY=X': 'TRY Pairs',
    'EURUSD=X': 'Majors', 'GBPUSD=X': 'Majors', 'USDJPY=X': 'Majors',
    'USDCHF=X': 'Majors', 'AUDUSD=X': 'Majors', 'NZDUSD=X': 'Majors',
    'USDCAD=X': 'Majors',
    'EURGBP=X': 'Crosses', 'EURJPY=X': 'Crosses', 'GBPJPY=X': 'Crosses',
    'USDCNY=X': 'EM', 'USDINR=X': 'EM',
};

// Commodity category map
const COMMODITY_CATEGORIES = {
    'GC=F': 'Precious Metals', 'SI=F': 'Precious Metals', 'PL=F': 'Precious Metals', 'PA=F': 'Precious Metals',
    'CL=F': 'Energy', 'BZ=F': 'Energy', 'NG=F': 'Energy',
    'HG=F': 'Industrial Metals',
    'ZC=F': 'Agriculture', 'ZW=F': 'Agriculture', 'ZS=F': 'Agriculture', 'KC=F': 'Agriculture',
};

// Fund/ETF category map
const FUND_CATEGORIES = {
    SPY: 'Index', QQQ: 'Index', IWM: 'Index', DIA: 'Index', VTI: 'Index', VOO: 'Index',
    XLF: 'Sector', XLK: 'Sector', XLE: 'Sector', XLV: 'Sector', IBB: 'Sector',
    TLT: 'Bond', AGG: 'Bond', HYG: 'Bond',
    GLD: 'Commodity', SLV: 'Commodity',
    VEA: 'International', VWO: 'International', EEM: 'International',
    ARKK: 'Thematic',
};

// Crypto category list for filter tabs
const CRYPTO_CATEGORY_LIST = ['All', 'Layer 1', 'DeFi', 'Meme', 'L2', 'AI', 'Gaming', 'Infrastructure', 'Exchange', 'Payment', 'Privacy', 'Social', 'Modular', 'Identity', 'Bridge'];
// BIST category list for filter tabs
const BIST_CATEGORY_LIST = ['All', 'Banking', 'Industrial', 'Holding', 'Energy', 'Consumer', 'Defense', 'Aviation', 'Telecom', 'Mining', 'Technology', 'Chemicals', 'Healthcare'];
// US category list for filter tabs
const US_CATEGORY_LIST = ['All', 'Technology', 'Finance', 'Healthcare', 'Consumer', 'Industrial', 'Energy', 'Communication', 'Utilities', 'REIT', 'Materials'];
// Forex category list
const FOREX_CATEGORY_LIST = ['All', 'TRY Pairs', 'Majors', 'Crosses', 'EM'];
// Commodity category list
const COMMODITY_CATEGORY_LIST = ['All', 'Precious Metals', 'Energy', 'Industrial Metals', 'Agriculture'];
// Fund/ETF category list
const FUND_CATEGORY_LIST = ['All', 'Index', 'Sector', 'Bond', 'Commodity', 'International', 'Thematic'];

function sparklineFromPrice(price) {
    const p = Number(price);
    return [p * 0.98, p * 0.99, p * 0.995, p * 1, p * 1.002, p * 1.005, p];
}

const tabs = [
    { id: 'crypto', label: 'Crypto' },
    { id: 'bist', label: 'BIST' },
    { id: 'us', label: 'US Stocks' },
    { id: 'forex', label: 'Forex' },
    { id: 'commodity', label: 'Commodities' },
    { id: 'fund', label: 'Funds/ETF' },
];

/** Auto-refresh interval (ms) - Market prices */
const MARKETS_REFRESH_INTERVAL_MS = 30 * 1000; // 30 seconds

export default function Markets() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('crypto');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [marketDataByTab, setMarketDataByTab] = useState({});
    const [loadingByTab, setLoadingByTab] = useState({});
    const [errorByTab, setErrorByTab] = useState({});

    const fetchCrypto = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, crypto: true }));
            setErrorByTab(prev => ({ ...prev, crypto: null }));
        }
        try {
            const res = await fetch('/api/markets/crypto');
            const json = await res.json();
            if (!json.ok || !json.result?.quotes) {
                throw new Error(json.message || 'Failed to fetch crypto data');
            }
            const assets = json.result.quotes.map((q, i) => ({
                id: i + 1,
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: Number(q.price) || 0,
                change: Number(q.changePercent) || 0,
                category: CRYPTO_CATEGORIES[q.symbol] || 'Crypto',
                sparkline: sparklineFromPrice(q.price),
                favorite: false
            }));
            setMarketDataByTab(prev => ({
                ...prev,
                crypto: {
                    categories: CRYPTO_CATEGORY_LIST,
                    assets
                }
            }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, crypto: err.message }));
            setMarketDataByTab(prev => ({ ...prev, crypto: null }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, crypto: false }));
        }
    }, []);

    const fetchBist = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, bist: true }));
            setErrorByTab(prev => ({ ...prev, bist: null }));
        }
        try {
            const res = await fetch('/api/markets/bist');
            const json = await res.json();
            if (!json.ok || !json.result?.quotes) {
                throw new Error(json.message || 'Failed to fetch BIST data');
            }
            const assets = json.result.quotes.map((q, i) => ({
                id: i + 1,
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: Number(q.price) || 0,
                change: Number(q.changePercent) || 0,
                category: BIST_CATEGORIES[q.symbol] || 'BIST',
                sparkline: sparklineFromPrice(q.price),
                favorite: false
            }));
            setMarketDataByTab(prev => ({
                ...prev,
                bist: {
                    categories: BIST_CATEGORY_LIST,
                    assets
                }
            }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, bist: err.message }));
            setMarketDataByTab(prev => ({ ...prev, bist: null }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, bist: false }));
        }
    }, []);

    const fetchUs = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, us: true }));
            setErrorByTab(prev => ({ ...prev, us: null }));
        }
        try {
            const res = await fetch('/api/markets/us');
            const json = await res.json();
            if (!json.ok || !json.result?.quotes) {
                throw new Error(json.message || 'Failed to fetch US market data');
            }
            const assets = json.result.quotes.map((q, i) => ({
                id: i + 1,
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: Number(q.price) || 0,
                change: Number(q.changePercent) || 0,
                category: US_CATEGORIES[q.symbol] || 'US',
                sparkline: sparklineFromPrice(q.price),
                favorite: false
            }));
            setMarketDataByTab(prev => ({
                ...prev,
                us: {
                    categories: US_CATEGORY_LIST,
                    assets
                }
            }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, us: err.message }));
            setMarketDataByTab(prev => ({ ...prev, us: null }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, us: false }));
        }
    }, []);

    const fetchForex = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, forex: true }));
            setErrorByTab(prev => ({ ...prev, forex: null }));
        }
        try {
            const res = await fetch('/api/markets/forex');
            const json = await res.json();
            if (!json.ok || !json.result?.quotes) {
                throw new Error(json.message || 'Failed to fetch forex data');
            }
            const assets = json.result.quotes.map((q, i) => ({
                id: i + 1,
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: Number(q.price) || 0,
                change: Number(q.changePercent) || 0,
                category: FOREX_CATEGORIES[q.symbol] || 'Forex',
                sparkline: sparklineFromPrice(q.price),
                favorite: false
            }));
            setMarketDataByTab(prev => ({
                ...prev,
                forex: {
                    categories: FOREX_CATEGORY_LIST,
                    assets
                }
            }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, forex: err.message }));
            setMarketDataByTab(prev => ({ ...prev, forex: null }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, forex: false }));
        }
    }, []);

    const fetchCommodity = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, commodity: true }));
            setErrorByTab(prev => ({ ...prev, commodity: null }));
        }
        try {
            const res = await fetch('/api/markets/commodity');
            const json = await res.json();
            if (!json.ok || !json.result?.quotes) {
                throw new Error(json.message || 'Failed to fetch commodity data');
            }
            const assets = json.result.quotes.map((q, i) => ({
                id: i + 1,
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: Number(q.price) || 0,
                change: Number(q.changePercent) || 0,
                category: COMMODITY_CATEGORIES[q.symbol] || 'Commodity',
                sparkline: sparklineFromPrice(q.price),
                favorite: false
            }));
            setMarketDataByTab(prev => ({
                ...prev,
                commodity: {
                    categories: COMMODITY_CATEGORY_LIST,
                    assets
                }
            }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, commodity: err.message }));
            setMarketDataByTab(prev => ({ ...prev, commodity: null }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, commodity: false }));
        }
    }, []);

    const fetchFund = useCallback(async (silent = false) => {
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, fund: true }));
            setErrorByTab(prev => ({ ...prev, fund: null }));
        }
        try {
            const res = await fetch('/api/markets/fund');
            const json = await res.json();
            if (!json.ok || !json.result?.quotes) {
                throw new Error(json.message || 'Failed to fetch fund/ETF data');
            }
            const assets = json.result.quotes.map((q, i) => ({
                id: i + 1,
                symbol: q.symbol,
                name: q.name || q.symbol,
                price: Number(q.price) || 0,
                change: Number(q.changePercent) || 0,
                category: FUND_CATEGORIES[q.symbol] || 'Fund',
                sparkline: sparklineFromPrice(q.price),
                favorite: false
            }));
            setMarketDataByTab(prev => ({
                ...prev,
                fund: {
                    categories: FUND_CATEGORY_LIST,
                    assets
                }
            }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, fund: err.message }));
            setMarketDataByTab(prev => ({ ...prev, fund: null }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, fund: false }));
        }
    }, []);

    const fetchMap = useMemo(() => ({
        crypto: fetchCrypto, bist: fetchBist, us: fetchUs,
        forex: fetchForex, commodity: fetchCommodity, fund: fetchFund,
    }), [fetchCrypto, fetchBist, fetchUs, fetchForex, fetchCommodity, fetchFund]);

    useEffect(() => {
        if (!marketDataByTab[activeTab] && !loadingByTab[activeTab] && fetchMap[activeTab]) {
            fetchMap[activeTab]();
        }
    }, [activeTab, marketDataByTab, loadingByTab, fetchMap]);

    // Auto-refresh: update data at intervals while active tab is open
    useEffect(() => {
        const fetcher = fetchMap[activeTab];
        if (!fetcher) return;
        const intervalId = setInterval(() => fetcher(true), MARKETS_REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [activeTab, fetchMap]);

    const categoryListMap = {
        crypto: CRYPTO_CATEGORY_LIST, bist: BIST_CATEGORY_LIST, us: US_CATEGORY_LIST,
        forex: FOREX_CATEGORY_LIST, commodity: COMMODITY_CATEGORY_LIST, fund: FUND_CATEGORY_LIST,
    };

    const currentMarket = useMemo(() => {
        const data = marketDataByTab[activeTab];
        if (data?.assets?.length) return data;
        return { categories: categoryListMap[activeTab] || US_CATEGORY_LIST, assets: [] };
    }, [activeTab, marketDataByTab]);

    const isLoadingMarket = loadingByTab[activeTab];
    const marketError = errorByTab[activeTab];

    // Reset category when changing tabs
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setSelectedCategory('All');
        setSearchQuery('');
    };

    // Filter assets
    const filteredAssets = useMemo(() => {
        return currentMarket.assets.filter(asset => {
            const matchesSearch =
                asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                asset.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || asset.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [currentMarket.assets, searchQuery, selectedCategory]);

    const formatPrice = (price, market) => {
        if (market === 'crypto' && price < 1) {
            return `$${price.toFixed(4)}`;
        }
        if (market === 'bist') {
            return `₺${price.toFixed(2)}`;
        }
        if (market === 'forex') {
            return price.toFixed(4);
        }
        return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="markets-page">
            {/* Market Tabs */}
            <section className="markets-header fade-in">
                <div className="market-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`market-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => handleTabChange(tab.id)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Filters */}
            <section className="markets-filters fade-in" style={{ animationDelay: '0.05s' }}>
                <div className="search-filter">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder={`Search ${tabs.find(t => t.id === activeTab)?.label}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="category-filters">
                    {currentMarket.categories.map(category => (
                        <button
                            key={category}
                            className={`category-btn ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </section>

            {/* Assets Table */}
            <section className="markets-table-section fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="table-wrapper">
                    {isLoadingMarket && (
                        <div className="markets-skeleton">
                            {Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} />)}
                        </div>
                    )}
                    {!isLoadingMarket && marketError && (
                        <div className="markets-error">
                            <p>{marketError}</p>
                            <button type="button" onClick={() => fetchMap[activeTab]?.()}>Retry</button>
                        </div>
                    )}
                    {!isLoadingMarket && !marketError ? (
                    <>
                    <table className="markets-table">
                        <thead>
                            <tr>
                                <th className="th-asset">Asset</th>
                                <th className="th-price">Price</th>
                                <th className="th-change">24h Change</th>
                                <th className="th-chart">7D Chart</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssets.map((asset, index) => (
                                    <tr
                                        key={asset.id}
                                        className="asset-row"
                                        style={{ animationDelay: `${index * 0.02}s` }}
                                        onClick={() => navigate(`/asset/${activeTab}/${asset.symbol}`)}
                                    >
                                        <td className="td-asset">
                                            <div className="asset-info">
                                                <span className="asset-symbol">{asset.symbol}</span>
                                                <span className="asset-name">{asset.name}</span>
                                            </div>
                                        </td>
                                        <td className="td-price">
                                            <span className="price-value">{formatPrice(asset.price, activeTab)}</span>
                                        </td>
                                        <td className="td-change">
                                            <span className={`change-value ${asset.change >= 0 ? 'positive' : 'negative'}`}>
                                                {asset.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                                                {asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%
                                            </span>
                                        </td>
                                        <td className="td-chart">
                                            <div className="sparkline-container">
                                                <ResponsiveContainer width="100%" height={32}>
                                                    <LineChart data={asset.sparkline.map(v => ({ value: v }))}>
                                                        <Line
                                                            type="monotone"
                                                            dataKey="value"
                                                            stroke={asset.change >= 0 ? '#3fb950' : '#f85149'}
                                                            strokeWidth={1.5}
                                                            dot={false}
                                                        />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </td>
                                    </tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredAssets.length === 0 && (
                        <div className="empty-state">
                            <Search size={32} />
                            <p>No assets found matching your criteria</p>
                        </div>
                    )}
                    </>
                    ) : null}
                </div>
            </section>

        </div>
    );
}
