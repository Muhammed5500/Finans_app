import './Skeleton.css';

export function Skeleton({ width, height = 16, borderRadius }) {
    const style = {
        width: typeof width === 'number' ? `${width}px` : width || '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: borderRadius || undefined,
    };
    return <div className="skeleton" style={style} />;
}

export function SkeletonText({ lines = 3 }) {
    return (
        <div className="skeleton-text">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} height={12} />
            ))}
        </div>
    );
}

export function SkeletonCard() {
    return (
        <div className="skeleton-card-block">
            <Skeleton height={14} width="40%" />
            <Skeleton height={20} width="70%" />
            <SkeletonText lines={2} />
        </div>
    );
}

export function SkeletonTableRow() {
    return (
        <div className="skeleton-table-row">
            <Skeleton width={24} height={24} borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Skeleton height={14} width="50%" />
                <Skeleton height={10} width="30%" />
            </div>
            <Skeleton width={80} height={16} />
            <Skeleton width={60} height={16} />
            <Skeleton width={80} height={32} borderRadius="4px" />
        </div>
    );
}

export function SkeletonNewsCard() {
    return (
        <div className="skeleton-news-card">
            <div className="skeleton-news-thumb">
                <Skeleton width="100%" height="100%" borderRadius="0" />
            </div>
            <div className="skeleton-news-content">
                <div style={{ display: 'flex', gap: 8 }}>
                    <Skeleton height={10} width={60} />
                    <Skeleton height={10} width={80} />
                </div>
                <Skeleton height={16} width="90%" />
                <SkeletonText lines={2} />
                <div style={{ display: 'flex', gap: 8 }}>
                    <Skeleton height={28} width={90} borderRadius="999px" />
                    <Skeleton height={28} width={120} borderRadius="999px" />
                </div>
            </div>
        </div>
    );
}
