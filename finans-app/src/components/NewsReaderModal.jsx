import { useState, useEffect } from 'react';
import {
    X,
    ExternalLink,
    Sparkles,
    TrendingUp,
    TrendingDown,
    Minus,
    Loader2,
    Tag,
    Clock,
} from 'lucide-react';
import { getSourceInfo } from '../constants/newsSourceLogos';
import './NewsReaderModal.css';

export default function NewsReaderModal({ article, onClose }) {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!article) return;
        let cancelled = false;
        setLoading(true);
        setAnalysis(null);

        fetch('/api/ai/analyze-news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: article.headline,
                source: article.sourceDisplayName || article.source,
                summary: article.preview,
                language: article.language || 'en',
            }),
        })
            .then(res => res.json())
            .then(json => {
                if (!cancelled && json.ok && json.result) {
                    setAnalysis(json.result);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setAnalysis({
                        quickLook: [],
                        affectedStocks: [],
                        sentiment: 'neutral',
                        marketImpact: '',
                        summary: 'Analiz yapılamadı.',
                        keyPoints: [],
                    });
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [article]);

    if (!article) return null;

    const sourceInfo = getSourceInfo(article.sourceId || article.source);

    return (
        <div className="reader-modal-overlay" onClick={onClose}>
            <div className="reader-modal" onClick={e => e.stopPropagation()}>
                {/* Left Column: Article */}
                <div className="reader-modal-article">
                    <div className="reader-modal-header">
                        <div className="reader-modal-source">
                            <div
                                className="source-logo"
                                style={{ background: sourceInfo.color }}
                            >
                                {sourceInfo.label.charAt(0)}
                            </div>
                            <div className="source-meta">
                                <span className="source-name">{sourceInfo.label}</span>
                                <span className="source-time">
                                    <Clock size={11} />
                                    {article.timestamp}
                                </span>
                            </div>
                        </div>
                        <button className="reader-modal-close" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>

                    {article.imageUrl && !article.imageUrl.includes('news-placeholder') && (
                        <img
                            src={article.imageUrl}
                            alt=""
                            className="reader-modal-image"
                            loading="lazy"
                        />
                    )}

                    <h2 className="reader-modal-title">{article.headline}</h2>

                    {article.preview && (
                        <p className="reader-modal-summary">{article.preview}</p>
                    )}

                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="reader-modal-link"
                    >
                        <ExternalLink size={14} /> Orijinal haberi oku
                    </a>
                </div>

                {/* Right Column: AI Analysis */}
                <div className="reader-modal-ai">
                    <div className="ai-section-header">
                        <Sparkles size={16} />
                        <span>Kamil AI Analizi</span>
                    </div>

                    {loading ? (
                        <div className="ai-section-loading">
                            <Loader2 size={24} className="spin" />
                            <span>Haber analiz ediliyor...</span>
                        </div>
                    ) : analysis ? (
                        <div className="ai-section-body">
                            {/* Quick Look */}
                            {analysis.quickLook?.length > 0 && (
                                <div className="ai-quick-look">
                                    <h4>Hızlı Bakış</h4>
                                    <ul>
                                        {analysis.quickLook.map((item, i) => (
                                            <li key={i}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Sentiment */}
                            <div>
                                <h4 style={{
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 'var(--font-semibold)',
                                    color: 'rgba(255,255,255,0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    margin: '0 0 var(--space-2) 0',
                                }}>Sentiment</h4>
                                <span className={`ai-sentiment-pill ${analysis.sentiment}`}>
                                    {analysis.sentiment === 'positive' && <TrendingUp size={14} />}
                                    {analysis.sentiment === 'negative' && <TrendingDown size={14} />}
                                    {analysis.sentiment === 'neutral' && <Minus size={14} />}
                                    {analysis.sentiment}
                                </span>
                            </div>

                            {/* Affected Stocks */}
                            {analysis.affectedStocks?.length > 0 && (
                                <div className="ai-affected-stocks">
                                    <h4>Etkilenen Hisseler</h4>
                                    <div className="ai-stock-chips">
                                        {analysis.affectedStocks.map((stock, i) => (
                                            <span key={i} className="ai-stock-chip">
                                                <Tag size={11} />
                                                {stock}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Market Impact */}
                            {analysis.marketImpact && (
                                <div className="ai-market-impact">
                                    <h4>Piyasa Etkisi</h4>
                                    <p>{analysis.marketImpact}</p>
                                </div>
                            )}

                            {/* Summary */}
                            {analysis.summary && (
                                <div className="ai-detail-summary">
                                    <h4>Özet</h4>
                                    <p>{analysis.summary}</p>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
