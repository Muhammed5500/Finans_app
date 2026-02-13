import { useState, useEffect, useCallback } from 'react';
import {
    Clock,
    Sparkles,
    HelpCircle,
    TrendingUp,
    TrendingDown,
    Minus,
    X,
    Loader2
} from 'lucide-react';
import { SkeletonNewsCard } from '../components/Skeleton';
import NewsReaderModal from '../components/NewsReaderModal';
import { getSourceInfo } from '../constants/newsSourceLogos';
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
        sourceId: item.source || '',
        sourceDisplayName: item.sourceDisplayName || item.source || 'Kaynak',
        headline: item.title || '',
        preview: item.summary || '',
        timestamp: relativeTime(item.publishedAt),
        tag: item.category || '',
        url: item.url || '#',
        imageUrl: item.imageUrl || NEWS_PLACEHOLDER,
        sentiment: item.sentiment || 'neutral',
        language: item.language || 'en',
    };
}

const tabs = [
    { id: 'crypto', label: 'Crypto' },
    { id: 'bist', label: 'BIST' },
    { id: 'us', label: 'US Markets' },
    { id: 'economy', label: 'Economy' },
];

// Fetch AI analysis from Gemini backend
async function fetchAIAnalysis(headline, source, preview, language) {
    const res = await fetch('/api/ai/analyze-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: headline, source, summary: preview, language }),
    });
    const json = await res.json();
    if (json.ok && json.result) return json.result;
    throw new Error('AI analysis failed');
}

const FEED_LIMIT = 20;

/** Otomatik yenileme aralığı (ms) - Haber listesi */
const NEWS_REFRESH_INTERVAL_MS = 120 * 1000; // 2 dakika

export default function News() {
    const [activeTab, setActiveTab] = useState('crypto');
    const [activeAI, setActiveAI] = useState(null); // { newsId, type }
    const [aiResponse, setAIResponse] = useState('');
    const [aiCache, setAiCache] = useState({}); // cache AI results per newsId
    const [isLoading, setIsLoading] = useState(false);
    const [newsByTab, setNewsByTab] = useState({});
    const [loadingByTab, setLoadingByTab] = useState({});
    const [errorByTab, setErrorByTab] = useState({});
    // News reader modal
    const [readerArticle, setReaderArticle] = useState(null);

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

    const handleAIAction = async (newsId, type, headline, source, preview, language) => {
        if (activeAI?.newsId === newsId && activeAI?.type === type) {
            setActiveAI(null);
            setAIResponse('');
            return;
        }

        setActiveAI({ newsId, type });
        setAIResponse('');

        // Use cached result if available
        if (aiCache[newsId]) {
            const cached = aiCache[newsId];
            if (type === 'summarize') {
                const ql = cached.quickLook?.length ? cached.quickLook.join('\n• ') : '';
                setAIResponse(ql ? `• ${ql}` : cached.summary);
            } else if (type === 'meaning') setAIResponse(cached.marketImpact || cached.summary);
            else if (type === 'impact') {
                const stocks = cached.affectedStocks?.length ? '\n\nEtkilenen: ' + cached.affectedStocks.join(', ') : '';
                setAIResponse(`${cached.summary}${stocks}`);
            }
            return;
        }

        setIsLoading(true);
        try {
            const result = await fetchAIAnalysis(headline, source, preview, language);
            setAiCache(prev => ({ ...prev, [newsId]: result }));
            if (type === 'summarize') {
                const ql = result.quickLook?.length ? result.quickLook.join('\n• ') : '';
                setAIResponse(ql ? `• ${ql}` : result.summary);
            } else if (type === 'meaning') setAIResponse(result.marketImpact || result.summary);
            else if (type === 'impact') {
                const stocks = result.affectedStocks?.length ? '\n\nEtkilenen: ' + result.affectedStocks.join(', ') : '';
                setAIResponse(`${result.summary}${stocks}`);
            }
        } catch {
            setAIResponse('AI analizi yapılamadı. Lütfen tekrar deneyin.');
        }
        setIsLoading(false);
    };

    // Open news reader modal
    const openReader = (article) => {
        setReaderArticle(article);
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
                                {(() => {
                                    const si = getSourceInfo(article.sourceId);
                                    return (
                                        <span className="source-indicator">
                                            <span className="source-indicator-dot" style={{ background: si.color }}>{si.label.charAt(0)}</span>
                                            <span className="news-source" style={{ color: si.color }}>{si.label}</span>
                                        </span>
                                    );
                                })()}
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
                                <button className="headline-btn" onClick={() => openReader(article)}>
                                    {article.headline}
                                    <Sparkles size={14} className="headline-ai-icon" />
                                </button>
                            </h3>

                            {/* Preview */}
                            <p className="news-preview">{article.preview}</p>

                            {/* AI Actions */}
                            <div className="news-actions">
                                <button
                                    className={`ai-action-btn ${activeAI?.newsId === article.id && activeAI?.type === 'summarize' ? 'active' : ''}`}
                                    onClick={() => handleAIAction(article.id, 'summarize', article.headline, article.source, article.preview, article.language)}
                                >
                                    <Sparkles size={14} />
                                    Özetle
                                </button>
                                <button
                                    className={`ai-action-btn ${activeAI?.newsId === article.id && activeAI?.type === 'meaning' ? 'active' : ''}`}
                                    onClick={() => handleAIAction(article.id, 'meaning', article.headline, article.source, article.preview, article.language)}
                                >
                                    <HelpCircle size={14} />
                                    Ne anlama geliyor?
                                </button>
                                <button
                                    className={`ai-action-btn ${activeAI?.newsId === article.id && activeAI?.type === 'impact' ? 'active' : ''}`}
                                    onClick={() => handleAIAction(article.id, 'impact', article.headline, article.source, article.preview, article.language)}
                                >
                                    <TrendingUp size={14} />
                                    Piyasa etkisi?
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

            {/* News Reader Modal */}
            {readerArticle && (
                <NewsReaderModal
                    article={readerArticle}
                    onClose={() => setReaderArticle(null)}
                />
            )}
        </div>
    );
}
