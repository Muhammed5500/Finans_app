import { XMLParser } from 'fast-xml-parser';
import {
  GoogleNewsRssFeed,
  GoogleNewsRssItem,
  SourceInfo,
} from './google-news.types';

/**
 * Google News RSS Parser
 *
 * Parses Google News RSS feeds into normalized structures.
 */

// XML Parser configuration
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
  cdataPropName: '__cdata',
});

/**
 * Build Google News RSS URL for a search query
 */
export function buildGoogleNewsRssUrl(
  query: string,
  hl = 'en-US',
  gl = 'US',
  ceid = 'US:en',
): string {
  const encodedQuery = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=${hl}&gl=${gl}&ceid=${ceid}`;
}

/**
 * Build Google News RSS URL for Turkish market
 */
export function buildGoogleNewsTurkishRssUrl(query: string): string {
  return buildGoogleNewsRssUrl(query, 'tr', 'TR', 'TR:tr');
}

/**
 * Parse Google News RSS feed
 */
export function parseGoogleNewsRss(xml: string): GoogleNewsRssItem[] {
  try {
    const parsed = xmlParser.parse(xml) as GoogleNewsRssFeed;
    const items: GoogleNewsRssItem[] = [];

    if (parsed.rss?.channel) {
      const channel = parsed.rss.channel;
      const channelItems = channel.item;

      if (channelItems) {
        const itemArray = Array.isArray(channelItems)
          ? channelItems
          : [channelItems];
        items.push(...itemArray.map(normalizeRssItem));
      }
    }

    return items;
  } catch (error) {
    throw new Error(
      `Failed to parse Google News RSS: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Normalize RSS item
 */
function normalizeRssItem(item: any): GoogleNewsRssItem {
  return {
    title: extractText(item.title),
    link: extractText(item.link),
    pubDate: extractText(item.pubDate),
    description: extractText(item.description),
    source: extractSource(item.source),
    guid: extractText(item.guid),
  };
}

/**
 * Extract text from various XML node formats
 */
function extractText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (node['#text']) return String(node['#text']);
  if (node.__cdata) return String(node.__cdata);
  return '';
}

/**
 * Extract source from Google News RSS
 * Can be string or object with @_url attribute
 */
function extractSource(source: any): string {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (source['#text']) return String(source['#text']);
  return '';
}

/**
 * Extract the actual article URL from Google News redirect URL
 * Google News URLs are in format: https://news.google.com/rss/articles/...
 * The actual URL is often in the link or can be decoded
 */
export function extractOriginalUrl(googleNewsUrl: string): string {
  // Google News URLs redirect to the original article
  // For RSS items, the link is usually already the redirect URL
  // We'll return as-is since following redirects would require HTTP calls
  return googleNewsUrl;
}

/**
 * Extract source name and potential original URL from description
 * Google News description often contains: "<a href="...">Source Name</a>"
 */
export function extractSourceInfo(description: string): SourceInfo {
  const info: SourceInfo = { name: '' };

  if (!description) return info;

  // Try to extract source name from HTML anchor
  const anchorMatch = description.match(/<a[^>]*>([^<]+)<\/a>/i);
  if (anchorMatch) {
    info.name = anchorMatch[1].trim();
  }

  // Try to extract URL from anchor
  const hrefMatch = description.match(/href=["']([^"']+)["']/i);
  if (hrefMatch) {
    info.originalUrl = hrefMatch[1];
  }

  return info;
}

/**
 * Clean HTML from title (Google News sometimes includes HTML entities)
 */
export function cleanTitle(title: string): string {
  if (!title) return '';

  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse RFC 2822 date (common in RSS)
 */
export function parseGoogleNewsDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Try native Date parsing (handles RFC 2822)
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  // Fallback to current time
  return new Date();
}

/**
 * Validate RSS item has required fields
 */
export function isValidGoogleNewsItem(item: GoogleNewsRssItem): boolean {
  return Boolean(item.title && item.link);
}

/**
 * Extract language from Google News URL or content
 */
export function detectLanguage(url: string, title: string): string {
  // Check URL for language hints
  if (url.includes('hl=tr') || url.includes('ceid=TR')) {
    return 'tr';
  }
  if (url.includes('hl=en') || url.includes('ceid=US')) {
    return 'en';
  }

  // Simple heuristic: check for Turkish characters
  if (/[ğüşıöçĞÜŞİÖÇ]/.test(title)) {
    return 'tr';
  }

  return 'en';
}
