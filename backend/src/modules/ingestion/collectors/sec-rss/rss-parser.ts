import { XMLParser } from 'fast-xml-parser';
import {
  SecRssFeed,
  SecRssItem,
  SecFilingType,
  FilingInfo,
} from './sec-rss.types';

/**
 * RSS/Atom XML Parser
 *
 * Parses SEC RSS and Atom feeds into normalized structures.
 */

// XML Parser configuration
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: true,
  trimValues: true,
  // Handle CDATA
  cdataPropName: '__cdata',
});

/**
 * Parse RSS/Atom XML to structured data
 */
export function parseRssFeed(xml: string): SecRssItem[] {
  try {
    const parsed = xmlParser.parse(xml) as SecRssFeed;
    const items: SecRssItem[] = [];

    // Handle RSS 2.0 format
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

    // Handle Atom format
    if (parsed.feed?.entry) {
      const entries = parsed.feed.entry;
      const entryArray = Array.isArray(entries) ? entries : [entries];
      items.push(...entryArray.map(normalizeAtomEntry));
    }

    return items;
  } catch (error) {
    throw new Error(
      `Failed to parse RSS feed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Normalize RSS 2.0 item
 */
function normalizeRssItem(item: any): SecRssItem {
  return {
    title: extractText(item.title),
    link: extractText(item.link),
    description: extractText(item.description),
    pubDate: extractText(item.pubDate),
    guid: extractText(item.guid),
    category: extractCategory(item.category),
  };
}

/**
 * Normalize Atom entry
 */
function normalizeAtomEntry(entry: any): SecRssItem {
  // Atom links can be objects with href attribute
  let link = '';
  if (entry.link) {
    if (typeof entry.link === 'string') {
      link = entry.link;
    } else if (Array.isArray(entry.link)) {
      // Find alternate or first link
      const altLink = entry.link.find((l: any) => l['@_rel'] === 'alternate');
      link = altLink?.['@_href'] || entry.link[0]?.['@_href'] || '';
    } else if (entry.link['@_href']) {
      link = entry.link['@_href'];
    }
  }

  return {
    title: extractText(entry.title),
    link,
    description: extractText(entry.summary || entry.content),
    pubDate: extractText(entry.updated || entry.published),
    id: extractText(entry.id),
    summary: extractText(entry.summary),
    category: extractCategory(entry.category),
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
 * Extract category from various formats
 */
function extractCategory(cat: any): string | string[] | undefined {
  if (!cat) return undefined;
  if (typeof cat === 'string') return cat;
  if (Array.isArray(cat)) {
    return cat
      .map((c) => (typeof c === 'string' ? c : c['@_term'] || c['#text'] || ''))
      .filter(Boolean);
  }
  if (cat['@_term']) return cat['@_term'];
  if (cat['#text']) return cat['#text'];
  return undefined;
}

/**
 * Extract SEC filing type from title
 *
 * SEC titles often have format: "8-K - COMPANY NAME (CIK)"
 */
export function extractFilingType(title: string): FilingInfo {
  const info: FilingInfo = { type: 'OTHER' };

  if (!title) return info;

  // Common SEC filing types with regex patterns
  const filingPatterns: Array<{ pattern: RegExp; type: SecFilingType }> = [
    { pattern: /\b8-K\b/i, type: '8-K' },
    { pattern: /\b10-K\b/i, type: '10-K' },
    { pattern: /\b10-Q\b/i, type: '10-Q' },
    { pattern: /\bForm 4\b|\b4\s*-\s*/i, type: '4' },
    { pattern: /\bS-1\b/i, type: 'S-1' },
    { pattern: /\bS-3\b/i, type: 'S-3' },
    { pattern: /\b13F\b/i, type: '13F' },
    { pattern: /\b13D\b/i, type: '13D' },
    { pattern: /\b13G\b/i, type: '13G' },
    { pattern: /\bDEF 14A\b/i, type: 'DEF 14A' },
    { pattern: /\b6-K\b/i, type: '6-K' },
    { pattern: /\b20-F\b/i, type: '20-F' },
  ];

  for (const { pattern, type } of filingPatterns) {
    if (pattern.test(title)) {
      info.type = type;
      break;
    }
  }

  // Try to extract company name
  // Format: "FILING_TYPE - COMPANY NAME (CIK)"
  const companyMatch = title.match(/^[\w\-\/]+\s*-\s*(.+?)(?:\s*\((\d+)\))?$/);
  if (companyMatch) {
    info.companyName = companyMatch[1].trim();
    if (companyMatch[2]) {
      info.cik = companyMatch[2];
    }
  }

  // Try to extract ticker from parentheses (sometimes format is "COMPANY (TICKER)")
  const tickerMatch = title.match(/\(([A-Z]{1,5})\)/);
  if (tickerMatch) {
    info.ticker = tickerMatch[1];
  }

  return info;
}

/**
 * Parse RFC 2822 date string (common in RSS)
 */
export function parseRssDate(dateStr: string): Date {
  if (!dateStr) return new Date();

  // Try native Date parsing first (handles RFC 2822)
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
export function isValidRssItem(item: SecRssItem): boolean {
  return Boolean(item.title && item.link);
}
