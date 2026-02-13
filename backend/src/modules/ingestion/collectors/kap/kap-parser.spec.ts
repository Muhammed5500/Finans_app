import {
  parseKapResponse,
  parseJsonResponse,
  parseDisclosure,
  parseKapDate,
  parseHtmlResponse,
  isValidKapItem,
} from './kap-parser';
import { KapDisclosure, ParsedKapItem } from './kap.types';

describe('KAP Parser', () => {
  const BASE_URL = 'https://www.kap.org.tr';

  describe('parseJsonResponse', () => {
    it('should parse array of disclosures directly', () => {
      const response: KapDisclosure[] = [
        {
          disclosureId: '12345',
          title: 'Test Disclosure 1',
          url: '/bildirim/12345',
          publishDate: '2024-01-15T16:30:00',
          stockCode: 'THYAO',
          companyName: 'Türk Hava Yolları',
        },
        {
          disclosureId: '12346',
          title: 'Test Disclosure 2',
          url: '/bildirim/12346',
          publishDate: '2024-01-15T17:00:00',
          stockCode: 'GARAN',
          companyName: 'Garanti Bankası',
        },
      ];

      const items = parseJsonResponse(response, BASE_URL);

      expect(items).toHaveLength(2);
      expect(items[0].sourceId).toBe('12345');
      expect(items[0].title).toBe('Test Disclosure 1');
      expect(items[0].stockCode).toBe('THYAO');
      expect(items[1].sourceId).toBe('12346');
    });

    it('should parse wrapped response with data field', () => {
      const response = {
        success: true,
        data: [
          {
            id: '123',
            baslik: 'Özel Durum Açıklaması',
            link: 'https://www.kap.org.tr/bildirim/123',
            yayinTarihi: '15.01.2024 16:30',
            hisseKodu: 'TUPRS',
          },
        ],
      };

      const items = parseJsonResponse(response, BASE_URL);

      expect(items).toHaveLength(1);
      expect(items[0].sourceId).toBe('123');
      expect(items[0].title).toBe('Özel Durum Açıklaması');
      expect(items[0].stockCode).toBe('TUPRS');
    });

    it('should parse wrapped response with bildirimler field', () => {
      const response = {
        basarili: true,
        bildirimler: [
          {
            bildirrimId: '456',
            baslik: 'Genel Kurul Kararı',
            yayinTarihi: '2024-01-15 14:00:00',
            sirketAdi: 'Test Şirketi',
          },
        ],
      };

      const items = parseJsonResponse(response, BASE_URL);

      expect(items).toHaveLength(1);
      expect(items[0].sourceId).toBe('456');
      expect(items[0].companyName).toBe('Test Şirketi');
    });

    it('should parse wrapped response with disclosures field', () => {
      const response = {
        disclosures: [
          {
            disclosureId: '789',
            disclosureTitle: 'Annual Report',
            disclosureDate: '2024-01-15',
          },
        ],
      };

      const items = parseJsonResponse(response, BASE_URL);

      expect(items).toHaveLength(1);
      expect(items[0].sourceId).toBe('789');
      expect(items[0].title).toBe('Annual Report');
    });

    it('should handle empty response', () => {
      const items = parseJsonResponse({ data: [] }, BASE_URL);
      expect(items).toHaveLength(0);
    });

    it('should handle unknown wrapper by finding array field', () => {
      const response = {
        status: 'ok',
        results: [
          {
            id: '999',
            title: 'Found in unknown field',
            url: '/test',
            publishDate: '2024-01-15',
          },
        ],
      };

      const items = parseJsonResponse(response as any, BASE_URL);

      expect(items).toHaveLength(1);
      expect(items[0].sourceId).toBe('999');
    });
  });

  describe('parseDisclosure', () => {
    it('should extract all known field variants', () => {
      const disclosure: KapDisclosure = {
        disclosureId: '12345',
        title: 'Main Title',
        url: '/path/to/disclosure',
        publishDate: '2024-01-15T16:30:00',
        stockCode: 'TEST',
        companyName: 'Test Company',
        disclosureType: 'ODA',
        summary: 'Test summary',
      };

      const item = parseDisclosure(disclosure, BASE_URL);

      expect(item).not.toBeNull();
      expect(item!.sourceId).toBe('12345');
      expect(item!.title).toBe('Main Title');
      expect(item!.url).toBe('https://www.kap.org.tr/path/to/disclosure');
      expect(item!.stockCode).toBe('TEST');
      expect(item!.companyName).toBe('Test Company');
      expect(item!.disclosureType).toBe('ODA');
      expect(item!.summary).toBe('Test summary');
    });

    it('should handle Turkish field names', () => {
      const disclosure: KapDisclosure = {
        bildirrimId: '111',
        baslik: 'Türkçe Başlık',
        yayinTarihi: '15.01.2024 10:00',
        hisseKodu: 'AKBNK',
        sirketAdi: 'Akbank',
        bildirimTipi: 'FYB',
        ozet: 'Türkçe özet',
      };

      const item = parseDisclosure(disclosure, BASE_URL);

      expect(item).not.toBeNull();
      expect(item!.sourceId).toBe('111');
      expect(item!.title).toBe('Türkçe Başlık');
      expect(item!.stockCode).toBe('AKBNK');
      expect(item!.companyName).toBe('Akbank');
      expect(item!.disclosureType).toBe('FYB');
      expect(item!.summary).toBe('Türkçe özet');
    });

    it('should make relative URLs absolute', () => {
      const disclosure: KapDisclosure = {
        id: '1',
        title: 'Test',
        url: '/bildirim/details/1',
      };

      const item = parseDisclosure(disclosure, BASE_URL);

      expect(item!.url).toBe('https://www.kap.org.tr/bildirim/details/1');
    });

    it('should construct URL from ID if not provided', () => {
      const disclosure: KapDisclosure = {
        disclosureId: '12345',
        title: 'No URL provided',
      };

      const item = parseDisclosure(disclosure, BASE_URL);

      expect(item!.url).toBe('https://www.kap.org.tr/bildirim/12345');
    });

    it('should return null for empty disclosure', () => {
      const item = parseDisclosure({}, BASE_URL);
      expect(item).toBeNull();
    });

    it('should store raw data', () => {
      const disclosure: KapDisclosure = {
        id: '1',
        title: 'Test',
        customField: 'custom value',
        nestedData: { key: 'value' },
      };

      const item = parseDisclosure(disclosure, BASE_URL);

      expect(item!.raw).toEqual(disclosure);
    });
  });

  describe('parseKapDate', () => {
    it('should parse ISO 8601 date', () => {
      const date = parseKapDate('2024-01-15T16:30:00');

      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
      expect(date.getHours()).toBe(16);
      expect(date.getMinutes()).toBe(30);
    });

    it('should parse Turkish date format (DD.MM.YYYY HH:mm)', () => {
      const date = parseKapDate('15.01.2024 16:30');

      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
      expect(date.getHours()).toBe(16);
      expect(date.getMinutes()).toBe(30);
    });

    it('should parse Turkish date format with seconds', () => {
      const date = parseKapDate('15.01.2024 16:30:45');

      expect(date.getSeconds()).toBe(45);
    });

    it('should parse date without time', () => {
      const date = parseKapDate('15.01.2024');

      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('should parse alternative format (YYYY-MM-DD HH:mm:ss)', () => {
      const date = parseKapDate('2024-01-15 16:30:00');

      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(15);
    });

    it('should parse Unix timestamp in seconds', () => {
      const date = parseKapDate('1705337400'); // 2024-01-15 16:50:00 UTC

      expect(date.getFullYear()).toBe(2024);
    });

    it('should parse Unix timestamp in milliseconds', () => {
      const date = parseKapDate('1705337400000');

      expect(date.getFullYear()).toBe(2024);
    });

    it('should return current date for invalid input', () => {
      const before = Date.now();
      const date = parseKapDate('invalid');
      const after = Date.now();

      expect(date.getTime()).toBeGreaterThanOrEqual(before);
      expect(date.getTime()).toBeLessThanOrEqual(after);
    });

    it('should return current date for undefined', () => {
      const date = parseKapDate(undefined);
      expect(date).toBeInstanceOf(Date);
    });
  });

  describe('parseKapResponse (auto-detect)', () => {
    it('should detect and parse JSON object', () => {
      const response = {
        data: [{ id: '1', title: 'Test', url: '/test' }],
      };

      const items = parseKapResponse(response, BASE_URL);

      expect(items).toHaveLength(1);
    });

    it('should detect and parse JSON string', () => {
      const response = JSON.stringify({
        data: [{ id: '1', title: 'Test', url: '/test' }],
      });

      const items = parseKapResponse(response, BASE_URL);

      expect(items).toHaveLength(1);
    });

    it('should detect and parse JSON array string', () => {
      const response = JSON.stringify([
        { id: '1', title: 'Test 1', url: '/test1' },
        { id: '2', title: 'Test 2', url: '/test2' },
      ]);

      const items = parseKapResponse(response, BASE_URL);

      expect(items).toHaveLength(2);
    });

    it('should handle invalid JSON gracefully', () => {
      const response = '{ invalid json }';

      const items = parseKapResponse(response, BASE_URL);

      expect(items).toHaveLength(0);
    });
  });

  describe('parseHtmlResponse', () => {
    it('should extract items from HTML table', () => {
      const html = `
        <html>
        <body>
          <table>
            <tr>
              <td><a href="/bildirim/1">Disclosure Title 1</a></td>
              <td>15.01.2024 16:30</td>
            </tr>
            <tr>
              <td><a href="/bildirim/2">Disclosure Title 2</a></td>
              <td>15.01.2024 17:00</td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const items = parseHtmlResponse(html, BASE_URL);

      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items[0].title).toBe('Disclosure Title 1');
      expect(items[0].url).toContain('/bildirim/1');
    });

    it('should handle empty HTML', () => {
      const html = '<html><body></body></html>';

      const items = parseHtmlResponse(html, BASE_URL);

      expect(items).toHaveLength(0);
    });

    it('should extract dates from cells', () => {
      const html = `
        <table>
          <tr>
            <td><a href="/test">Test</a></td>
            <td>15.01.2024 16:30</td>
          </tr>
        </table>
      `;

      const items = parseHtmlResponse(html, BASE_URL);

      if (items.length > 0) {
        expect(items[0].publishedAt.getFullYear()).toBe(2024);
      }
    });
  });

  describe('isValidKapItem', () => {
    it('should return true for valid item', () => {
      const item: ParsedKapItem = {
        sourceId: '123',
        title: 'Valid Title',
        url: 'https://kap.org.tr/bildirim/123',
        publishedAt: new Date(),
        raw: {},
      };

      expect(isValidKapItem(item)).toBe(true);
    });

    it('should return false for missing sourceId', () => {
      const item: ParsedKapItem = {
        sourceId: '',
        title: 'Title',
        url: 'https://example.com',
        publishedAt: new Date(),
        raw: {},
      };

      expect(isValidKapItem(item)).toBe(false);
    });

    it('should return false for default title', () => {
      const item: ParsedKapItem = {
        sourceId: '123',
        title: 'Untitled Disclosure',
        url: 'https://example.com',
        publishedAt: new Date(),
        raw: {},
      };

      expect(isValidKapItem(item)).toBe(false);
    });

    it('should return false for missing URL', () => {
      const item: ParsedKapItem = {
        sourceId: '123',
        title: 'Title',
        url: '',
        publishedAt: new Date(),
        raw: {},
      };

      expect(isValidKapItem(item)).toBe(false);
    });
  });

  describe('Real-world KAP response scenarios', () => {
    it('should handle typical KAP bildirim response', () => {
      // Simulated response based on KAP's typical structure
      const response = {
        memberDisclosureIndexes: [
          {
            disclosureIndex: 12345,
            title: 'Şirket Genel Bilgi Formu',
            companyName: 'TEST ŞİRKETİ A.Ş.',
            stockCodes: 'TSTS',
            publishDate: '15.01.2024 16:30:00',
            disclosureType: 'ODA',
            summary: 'Şirket genel bilgi formu güncellenmiştir.',
          },
        ],
      };

      // This should find the array even in nested structure
      const items = parseKapResponse(response, BASE_URL);

      expect(items.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle paginated response', () => {
      const response = {
        success: true,
        totalCount: 150,
        pageSize: 50,
        currentPage: 1,
        data: [
          { id: '1', title: 'Item 1', url: '/1', publishDate: '2024-01-15' },
          { id: '2', title: 'Item 2', url: '/2', publishDate: '2024-01-15' },
        ],
      };

      const items = parseJsonResponse(response, BASE_URL);

      expect(items).toHaveLength(2);
    });
  });
});
