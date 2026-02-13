import { KapApiResponse, KapDisclosure, ParsedKapItem } from './kap.types';

/**
 * KAP Response Parser
 *
 * Parses KAP API responses in various formats (JSON, HTML).
 * Implements a flexible parsing strategy to handle different response structures.
 */

/**
 * Parse KAP API response (auto-detect format)
 */
export function parseKapResponse(
  response: string | object,
  baseUrl: string,
): ParsedKapItem[] {
  // If already an object, treat as JSON
  if (typeof response === 'object' && response !== null) {
    return parseJsonResponse(response as KapApiResponse, baseUrl);
  }

  // Try to detect format from string
  const responseStr = String(response).trim();

  // Try JSON first
  if (responseStr.startsWith('{') || responseStr.startsWith('[')) {
    try {
      const parsed = JSON.parse(responseStr);
      return parseJsonResponse(parsed, baseUrl);
    } catch {
      // Not valid JSON, fall through to HTML
    }
  }

  // Try HTML parsing
  if (responseStr.includes('<html') || responseStr.includes('<table')) {
    return parseHtmlResponse(responseStr, baseUrl);
  }

  // Unknown format
  return [];
}

/**
 * Parse JSON response from KAP
 */
export function parseJsonResponse(
  response: KapApiResponse | KapDisclosure[],
  baseUrl: string,
): ParsedKapItem[] {
  const items: ParsedKapItem[] = [];

  // Handle array directly
  if (Array.isArray(response)) {
    for (const disclosure of response) {
      const parsed = parseDisclosure(disclosure, baseUrl);
      if (parsed) {
        items.push(parsed);
      }
    }
    return items;
  }

  // Handle wrapped response
  const disclosures = extractDisclosuresArray(response);

  for (const disclosure of disclosures) {
    const parsed = parseDisclosure(disclosure, baseUrl);
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
}

/**
 * Extract disclosures array from various response formats
 */
function extractDisclosuresArray(response: KapApiResponse): KapDisclosure[] {
  // Try common field names
  if (response.data && Array.isArray(response.data)) {
    return response.data;
  }
  if (response.bildirimler && Array.isArray(response.bildirimler)) {
    return response.bildirimler;
  }
  if (response.disclosures && Array.isArray(response.disclosures)) {
    return response.disclosures;
  }
  if (response.items && Array.isArray(response.items)) {
    return response.items;
  }

  // Check for nested data structures
  for (const key of Object.keys(response)) {
    const value = response[key];
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      typeof value[0] === 'object'
    ) {
      return value as KapDisclosure[];
    }
  }

  return [];
}

/**
 * Parse single disclosure object into normalized item
 */
export function parseDisclosure(
  disclosure: KapDisclosure,
  baseUrl: string,
): ParsedKapItem | null {
  if (!disclosure) return null;

  // Extract ID (try multiple field names)
  const sourceId = String(
    disclosure.disclosureId ||
      disclosure.id ||
      disclosure.bildirrimId ||
      disclosure.url ||
      disclosure.link ||
      '',
  );

  if (!sourceId) return null;

  // Extract title
  const title =
    disclosure.title ||
    disclosure.baslik ||
    disclosure.disclosureTitle ||
    disclosure.summary ||
    disclosure.ozet ||
    'Untitled Disclosure';

  // Extract URL
  let url = disclosure.url || disclosure.link || disclosure.pdfUrl || '';
  if (url && !url.startsWith('http')) {
    // Make relative URLs absolute
    url = new URL(url, baseUrl).toString();
  }
  // Fallback: construct URL from ID
  if (!url && sourceId) {
    url = `${baseUrl}/bildirim/${sourceId}`;
  }

  // Extract publish date
  const publishDateStr =
    disclosure.publishDate ||
    disclosure.yayinTarihi ||
    disclosure.disclosureDate;
  const publishedAt = parseKapDate(publishDateStr);

  // Extract optional fields
  const stockCode = disclosure.stockCode || disclosure.hisseKodu;
  const companyName = disclosure.companyName || disclosure.sirketAdi;
  const disclosureType = disclosure.disclosureType || disclosure.bildirimTipi;
  const summary = disclosure.summary || disclosure.ozet || disclosure.content;

  return {
    sourceId,
    title: String(title).trim(),
    url,
    publishedAt,
    stockCode,
    companyName,
    disclosureType,
    summary,
    raw: { ...disclosure },
  };
}

/**
 * Parse KAP date string into Date object
 * Handles various Turkish date formats
 */
export function parseKapDate(dateStr: string | undefined): Date {
  if (!dateStr) return new Date();

  // Try direct parsing first (ISO format)
  const directParse = new Date(dateStr);
  if (!isNaN(directParse.getTime())) {
    return directParse;
  }

  // Turkish date format: DD.MM.YYYY HH:mm or DD.MM.YYYY HH:mm:ss
  const turkishMatch = dateStr.match(
    /(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (turkishMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] =
      turkishMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    );
  }

  // Alternative Turkish format: YYYY-MM-DD HH:mm:ss
  const altMatch = dateStr.match(
    /(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (altMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0'] =
      altMatch;
    return new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hour),
      parseInt(minute),
      parseInt(second),
    );
  }

  // Unix timestamp (seconds)
  if (/^\d{10}$/.test(dateStr)) {
    return new Date(parseInt(dateStr) * 1000);
  }

  // Unix timestamp (milliseconds)
  if (/^\d{13}$/.test(dateStr)) {
    return new Date(parseInt(dateStr));
  }

  return new Date();
}

/**
 * Parse HTML response (fallback parser)
 * Basic extraction from HTML table structure
 */
export function parseHtmlResponse(
  html: string,
  baseUrl: string,
): ParsedKapItem[] {
  const items: ParsedKapItem[] = [];

  // Basic regex-based extraction from table rows
  // This is a fallback - production should use proper HTML parser like cheerio
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  const linkRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i;
  const dateRegex = /(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/;

  let rowMatch;
  let index = 0;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    const cells: string[] = [];

    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      // Strip HTML tags for text content
      const cellText = cellMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      cells.push(cellText);
    }

    // Skip header rows or empty rows
    if (cells.length < 2) continue;

    // Try to extract link from row
    const linkMatch = rowContent.match(linkRegex);
    let url = '';
    let title = '';

    if (linkMatch) {
      url = linkMatch[1];
      title = linkMatch[2].replace(/<[^>]+>/g, '').trim();
      if (url && !url.startsWith('http')) {
        url = new URL(url, baseUrl).toString();
      }
    }

    // Try to extract date
    let publishedAt = new Date();
    for (const cell of cells) {
      const dateMatch = cell.match(dateRegex);
      if (dateMatch) {
        publishedAt = parseKapDate(cell);
        break;
      }
    }

    // Use first cell as title if not found from link
    if (!title && cells[0]) {
      title = cells[0];
    }

    // Generate sourceId
    const sourceId = url || `html-row-${index}`;

    if (title || url) {
      items.push({
        sourceId,
        title: title || 'Untitled',
        url: url || `${baseUrl}#row-${index}`,
        publishedAt,
        raw: { cells, rowHtml: rowContent },
      });
    }

    index++;
  }

  return items;
}

/**
 * Validate parsed item has required fields
 */
export function isValidKapItem(item: ParsedKapItem): boolean {
  return Boolean(
    item.sourceId &&
    item.title &&
    item.title !== 'Untitled Disclosure' &&
    item.url,
  );
}
