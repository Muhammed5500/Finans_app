import { useState, useEffect, useCallback } from 'react';
import {
    Clock,
    ExternalLink,
    Sparkles,
    HelpCircle,
    TrendingUp,
    TrendingDown,
    Minus,
    X,
    Loader2
} from 'lucide-react';
import { SkeletonNewsCard } from '../components/Skeleton';
import './News.css';
import newsPlaceholderUrl from '../assets/news-placeholder.svg';

// Yerel placeholder: Vite import ile her ortamda doğru yol
const NEWS_PLACEHOLDER = newsPlaceholderUrl;

// API category mapping: tab id -> finans-api category
const TAB_TO_CATEGORY = {
    crypto: 'crypto',
    bist: 'bist',
    us: 'us',
    economy: 'economy'
};

function relativeTime(isoDate) {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const sec = Math.floor((now - date) / 1000);
    if (sec < 60) return 'Az önce';
    if (sec < 3600) return `${Math.floor(sec / 60)} dakika önce`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} saat önce`;
    if (sec < 604800) return `${Math.floor(sec / 86400)} gün önce`;
    return date.toLocaleDateString();
}

/** Map finans-api news item to card format */
function mapNewsItemToCard(item) {
    return {
        id: item.id,
        source: item.source || 'Kaynak',
        headline: item.title || '',
        preview: item.summary || '',
        timestamp: relativeTime(item.publishedAt),
        tag: item.category || '',
        url: item.url || '#',
        imageUrl: item.imageUrl || NEWS_PLACEHOLDER,
        sentiment: item.sentiment || 'neutral',
    };
}

const tabs = [
    { id: 'crypto', label: 'Crypto' },
    { id: 'bist', label: 'BIST' },
    { id: 'us', label: 'US Markets' },
    { id: 'economy', label: 'Economy' },
];

// AI response generator (simulated)
const getAIResponse = (type, headline) => {
    const responses = {
        summarize: {
            'Bitcoin ETF Inflows Reach $1.2 Billion in Single Week':
                'Institutional investors are continuing to buy Bitcoin through regulated ETF products. The $1.2B weekly inflow suggests sustained demand from traditional finance. BlackRock\'s fund is leading, which indicates major institutions are comfortable with Bitcoin as an asset class.',
            'Fed Signals Patience on Rate Cuts, Markets Adjust Expectations':
                'The Federal Reserve is indicating it won\'t rush to cut interest rates. Markets had been expecting cuts sooner, but now need to adjust. This typically means higher borrowing costs for longer, which can pressure growth stocks and benefit savers.',
            'default': 'This news discusses recent market developments. The key takeaway is that market conditions are evolving based on new information. Investors should consider how this aligns with their investment thesis and time horizon.'
        },
        meaning: {
            'Bitcoin ETF Inflows Reach $1.2 Billion in Single Week':
                'For you as an investor: More institutional money in Bitcoin ETFs could support prices and reduce volatility over time. It also signals that Bitcoin is becoming a more accepted part of diversified portfolios. However, large inflows can sometimes precede short-term pullbacks.',
            'Fed Signals Patience on Rate Cuts, Markets Adjust Expectations':
                'For you as an investor: Higher interest rates for longer means savings accounts and bonds become more attractive. Growth stocks and real estate may face some pressure. If you have variable-rate debt, costs may stay elevated. Consider reviewing your asset allocation.',
            'default': 'This news may affect your portfolio depending on your holdings. Consider whether your current investment strategy accounts for these developments. If unsure, maintaining a diversified approach typically provides resilience.'
        },
        impact: {
            'Bitcoin ETF Inflows Reach $1.2 Billion in Single Week':
                'Potential impacts: (+) Positive for BTC price support, (+) May increase legitimacy of crypto assets, (+) Could attract more institutional products. (-) Large inflows sometimes signal short-term tops, (-) Regulatory scrutiny may increase.',
            'Fed Signals Patience on Rate Cuts, Markets Adjust Expectations':
                'Potential impacts: (-) Negative for growth stocks in short term, (-) Higher mortgage/loan rates persist, (+) Positive for bank margins, (+) Good for fixed income yields, (=) Neutral for companies with strong cash flows.',
            'default': 'Market impact will depend on how participants interpret this news. Historically, markets price in expected changes, so surprises tend to have the largest effects. Monitor related assets for confirmation of any trend.'
        }
    };

    return responses[type][headline] || responses[type]['default'];
};

const FEED_LIMIT = 20;

/** Otomatik yenileme aralığı (ms) - Haber listesi */
const NEWS_REFRESH_INTERVAL_MS = 120 * 1000; // 2 dakika

export default function News() {
    const [activeTab, setActiveTab] = useState('crypto');
    const [activeAI, setActiveAI] = useState(null); // { newsId, type }
    const [aiResponse, setAIResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [newsByTab, setNewsByTab] = useState({});
    const [loadingByTab, setLoadingByTab] = useState({});
    const [errorByTab, setErrorByTab] = useState({});

    const fetchNews = useCallback(async (tabId, silent = false) => {
        const category = TAB_TO_CATEGORY[tabId] ?? tabId;
        if (!silent) {
            setLoadingByTab(prev => ({ ...prev, [tabId]: true }));
            setErrorByTab(prev => ({ ...prev, [tabId]: null }));
        }
        try {
            const res = await fetch(
                `/api/news?category=${encodeURIComponent(category)}&limit=${FEED_LIMIT}`
            );
            const json = await res.json();
            if (!json.ok) {
                throw new Error(json?.message ?? `HTTP ${res.status}`);
            }
            const items = json?.result?.items ?? [];
            setNewsByTab(prev => ({ ...prev, [tabId]: items.map(mapNewsItemToCard) }));
        } catch (err) {
            setErrorByTab(prev => ({ ...prev, [tabId]: err.message }));
            setNewsByTab(prev => ({ ...prev, [tabId]: [] }));
        } finally {
            setLoadingByTab(prev => ({ ...prev, [tabId]: false }));
        }
    }, []);

    useEffect(() => {
        if (!newsByTab[activeTab] && !loadingByTab[activeTab]) {
            fetchNews(activeTab);
        }
    }, [activeTab, fetchNews, newsByTab, loadingByTab]);

    // Otomatik yenileme: Açık olan haber kategorisi belirli aralıklarla güncellenir
    useEffect(() => {
        const intervalId = setInterval(() => {
            fetchNews(activeTab, true);
        }, NEWS_REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [activeTab, fetchNews]);

    const currentNews = newsByTab[activeTab] ?? [];
    const isLoadingFeed = loadingByTab[activeTab];
    const feedError = errorByTab[activeTab];

    const handleAIAction = (newsId, type, headline) => {
        if (activeAI?.newsId === newsId && activeAI?.type === type) {
            // Toggle off if same action
            setActiveAI(null);
            setAIResponse('');
            return;
        }

        setIsLoading(true);
        setActiveAI({ newsId, type });

        // Simulate AI response delay
        setTimeout(() => {
            setAIResponse(getAIResponse(type, headline));
            setIsLoading(false);
        }, 800);
    };

    const closeAIPanel = () => {
        setActiveAI(null);
        setAIResponse('');
    };

    const getActionLabel = (type) => {
        switch (type) {
            case 'summarize': return 'Summary';
            case 'meaning': return 'What This Means';
            case 'impact': return 'Market Impact';
            default: return type;
        }
    };

    return (
        <div className="news-page">
            {/* Tabs */}
            <section className="news-header fade-in">
                <div className="news-tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`news-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => {
                                setActiveTab(tab.id);
                                closeAIPanel();
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* News List */}
            <section className="news-list">
                {isLoadingFeed && (
                    <div className="news-skeleton-list">
                        {[1, 2, 3, 4].map(i => <SkeletonNewsCard key={i} />)}
                    </div>
                )}
                {!isLoadingFeed && feedError && (
                    <div className="news-feed-error">
                        <p>Haberler yüklenemedi: {feedError}</p>
                        <p className="news-feed-error-hint">finans-api (3002) çalışıyor mu? (category: {TAB_TO_CATEGORY[activeTab]})</p>
                        <button type="button" onClick={() => fetchNews(activeTab)}>Tekrar dene</button>
                    </div>
                )}
                {!isLoadingFeed && !feedError && currentNews.length === 0 && (
                    <div className="news-feed-empty">
                        <p>Bu kategoride henüz haber yok.</p>
                        <p className="news-feed-empty-hint">Harici haber kaynağı yanıt vermedi. Lütfen tekrar deneyin.</p>
                    </div>
                )}
                {!isLoadingFeed && !feedError && currentNews.map((article, index) => (
                    <article
                        key={article.id}
                        className={`news-card fade-in ${activeAI?.newsId === article.id ? 'has-ai-panel' : ''}`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                    >
                        <div className="news-card-inner">
                            {/* Sol: kare haber görseli */}
                            <div className="news-thumbnail">
                                <img
                                    src={article.imageUrl}
                                    alt=""
                                    width={120}
                                    height={120}
                                    loading="lazy"
                                    className="news-thumbnail-img"
                                />
                            </div>
                            <div className="news-content">
                            {/* Header */}
                            <div className="news-meta">
                                <span className="news-source">{article.source}</span>
                                <span className="news-dot">·</span>
                                <span className="news-time">
                                    <Clock size={12} />
                                    {article.timestamp}
                                </span>
                                <span className={`sentiment-badge ${article.sentiment}`}>
                                    {article.sentiment === 'positive' && <TrendingUp size={12} />}
                                    {article.sentiment === 'negative' && <TrendingDown size={12} />}
                                    {article.sentiment === 'neutral' && <Minus size={12} />}
                                    {article.sentiment.charAt(0).toUpperCase() + article.sentiment.slice(1)}
                                </span>
                                <span className="news-tag">{article.tag}</span>
                            </div>

                            {/* Headline */}
                            <h3 className="news-headline">
                                <a href={article.url} target="_blank" rel="noopener noreferrer">
                                    {article.headline}
                                    <ExternalLink size={14} className="external-icon" />
                                </a>
                            </h3>

                            {/* Preview */}
                            <p className="news-preview">{article.preview}</p>

                            {/* AI Actions */}
                            <div className="news-actions">
                                <button
                                    className={`ai-action-btn ${activeAI?.newsId === article.id && activeAI?.type === 'summarize' ? 'active' : ''}`}
                                    onClick={() => handleAIAction(article.id, 'summarize', article.headline)}
                                >
                                    <Sparkles size={14} />
                                    Summarize
                                </button>
                                <button
                                    className={`ai-action-btn ${activeAI?.newsId === article.id && activeAI?.type === 'meaning' ? 'active' : ''}`}
                                    onClick={() => handleAIAction(article.id, 'meaning', article.headline)}
                                >
                                    <HelpCircle size={14} />
                                    What does this mean?
                                </button>
                                <button
                                    className={`ai-action-btn ${activeAI?.newsId === article.id && activeAI?.type === 'impact' ? 'active' : ''}`}
                                    onClick={() => handleAIAction(article.id, 'impact', article.headline)}
                                >
                                    <TrendingUp size={14} />
                                    Market impact?
                                </button>
                            </div>
                            </div>
                        </div>

                        {/* AI Response Panel */}
                        {activeAI?.newsId === article.id && (
                            <div className="ai-panel">
                                <div className="ai-panel-header">
                                    <div className="ai-panel-title">
                                        <Sparkles size={16} />
                                        <span>AI {getActionLabel(activeAI.type)}</span>
                                    </div>
                                    <button className="ai-panel-close" onClick={closeAIPanel}>
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="ai-panel-content">
                                    {isLoading ? (
                                        <div className="ai-loading">
                                            <Loader2 size={20} className="spin" />
                                            <span>Analyzing...</span>
                                        </div>
                                    ) : (
                                        <p>{aiResponse}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </article>
                ))}
            </section>
        </div>
    );
}
