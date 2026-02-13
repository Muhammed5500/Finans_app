import { extractTickers, extractTags } from './tagging.service';

describe('extractTickers', () => {
  describe('exact symbol matches', () => {
    it('should extract single ticker symbol', () => {
      expect(extractTickers('AAPL shares rise 5%')).toContain('AAPL');
    });

    it('should extract multiple ticker symbols', () => {
      const result = extractTickers('AAPL and TSLA lead tech rally');
      expect(result).toContain('AAPL');
      expect(result).toContain('TSLA');
    });

    it('should extract ticker with $ prefix', () => {
      expect(extractTickers('$AAPL hits new high')).toContain('AAPL');
    });

    it('should extract BIST tickers', () => {
      const result = extractTickers('THYAO and TUPRS lead BIST gains');
      expect(result).toContain('THYAO');
      expect(result).toContain('TUPRS');
    });

    it('should extract crypto tickers', () => {
      const result = extractTickers('BTC breaks $60k, ETH follows');
      expect(result).toContain('BTC');
      expect(result).toContain('ETH');
    });

    it('should extract macro tickers', () => {
      const result = extractTickers('FED rate decision impacts DXY');
      expect(result).toContain('FED');
      expect(result).toContain('DXY');
    });
  });

  describe('alias matches', () => {
    it('should match Bitcoin to BTC', () => {
      expect(extractTickers('Bitcoin rallies past $60,000')).toContain('BTC');
    });

    it('should match Ethereum to ETH', () => {
      expect(extractTickers('Ethereum 2.0 upgrade complete')).toContain('ETH');
    });

    it('should match Apple to AAPL', () => {
      expect(extractTickers('Apple announces new iPhone')).toContain('AAPL');
    });

    it('should match Tesla to TSLA', () => {
      expect(
        extractTickers('Tesla delivery numbers beat expectations'),
      ).toContain('TSLA');
    });

    it('should match Federal Reserve to FED', () => {
      const result = extractTickers('Federal Reserve hints at rate cut');
      expect(result).toContain('FED');
    });

    it('should match Turkish company names', () => {
      const result = extractTickers('Turkish Airlines reports strong quarter');
      expect(result).toContain('THYAO');
    });

    it('should match THY abbreviation', () => {
      expect(extractTickers('THY uçuşları artıyor')).toContain('THYAO');
    });

    it('should match Garanti Bankası', () => {
      expect(extractTickers('Garanti Bankası yeni şube açtı')).toContain(
        'GARAN',
      );
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty string', () => {
      expect(extractTickers('')).toEqual([]);
    });

    it('should return empty array for null/undefined', () => {
      expect(extractTickers(null as any)).toEqual([]);
      expect(extractTickers(undefined as any)).toEqual([]);
    });

    it('should not match common words', () => {
      const result = extractTickers('The market is up today');
      expect(result).not.toContain('THE');
      expect(result).not.toContain('IS');
      expect(result).not.toContain('UP');
    });

    it('should handle case insensitivity for aliases', () => {
      expect(extractTickers('BITCOIN rallies')).toContain('BTC');
      expect(extractTickers('bitcoin rallies')).toContain('BTC');
      expect(extractTickers('Bitcoin rallies')).toContain('BTC');
    });

    it('should return unique tickers only', () => {
      const result = extractTickers('Apple AAPL Apple AAPL earnings');
      const aaplCount = result.filter((t) => t === 'AAPL').length;
      expect(aaplCount).toBe(1);
    });
  });

  describe('real-world headlines', () => {
    it('should extract from Bloomberg-style headline', () => {
      const result = extractTickers(
        'Apple Rises as iPhone Sales Beat Estimates; Tesla Falls on Deliveries Miss',
      );
      expect(result).toContain('AAPL');
      expect(result).toContain('TSLA');
    });

    it('should extract from Reuters-style headline', () => {
      const result = extractTickers(
        'Federal Reserve keeps rates steady, signals caution on inflation',
      );
      expect(result).toContain('FED');
    });

    it('should extract from Turkish news headline', () => {
      const result = extractTickers("Borsa İstanbul'da THYAO ve TUPRS zirvede");
      expect(result).toContain('THYAO');
      expect(result).toContain('TUPRS');
    });

    it('should extract tupras alias (ASCII version)', () => {
      // Note: Turkish special characters (ü, ş) require explicit aliases
      const result = extractTickers('Tupras hisseleri yukseliyor');
      expect(result).toContain('TUPRS');
    });

    it('should extract from crypto news headline', () => {
      const result = extractTickers(
        'Bitcoin and Ethereum hit new highs as crypto market surges',
      );
      expect(result).toContain('BTC');
      expect(result).toContain('ETH');
    });

    it('should extract from mixed headline', () => {
      const result = extractTickers(
        'NVDA surges on AI demand; Fed decision looms; Bitcoin steady',
      );
      expect(result).toContain('NVDA');
      expect(result).toContain('FED');
      expect(result).toContain('BTC');
    });
  });
});

describe('extractTags', () => {
  describe('market events', () => {
    it('should tag earnings news', () => {
      const result = extractTags('Apple Q3 earnings beat estimates');
      expect(result).toContain('earnings');
    });

    it('should tag merger news', () => {
      const result = extractTags('Microsoft to acquire gaming company');
      expect(result).toContain('merger');
    });

    it('should tag IPO news', () => {
      const result = extractTags('Tech startup files for IPO');
      expect(result).toContain('ipo');
    });

    it('should tag dividend news', () => {
      const result = extractTags('Company announces special dividend');
      expect(result).toContain('dividend');
    });

    it('should tag buyback news', () => {
      const result = extractTags('Apple announces $90B stock buyback');
      expect(result).toContain('buyback');
    });
  });

  describe('corporate events', () => {
    it('should tag layoffs news', () => {
      const result = extractTags('Tech giant announces 10,000 layoffs');
      expect(result).toContain('layoffs');
    });

    it('should tag lawsuit news', () => {
      const result = extractTags('Company sued over patent infringement');
      expect(result).toContain('lawsuit');
    });

    it('should tag regulation news', () => {
      const result = extractTags('SEC launches investigation into trading');
      expect(result).toContain('regulation');
    });
  });

  describe('macro/economic', () => {
    it('should tag macro news', () => {
      const result = extractTags('US GDP grows 2.5% in Q3');
      expect(result).toContain('macro');
    });

    it('should tag rates news', () => {
      const result = extractTags('Fed raises interest rate by 25 basis points');
      expect(result).toContain('rates');
    });

    it('should tag inflation news', () => {
      const result = extractTags('CPI data shows inflation cooling');
      expect(result).toContain('inflation');
    });
  });

  describe('asset classes', () => {
    it('should tag crypto news', () => {
      const result = extractTags('Bitcoin hits new all-time high');
      expect(result).toContain('crypto');
    });

    it('should tag commodities news', () => {
      const result = extractTags('Gold prices surge amid uncertainty');
      expect(result).toContain('commodities');
    });

    it('should tag forex news', () => {
      const result = extractTags('Dollar strengthens against euro');
      expect(result).toContain('forex');
    });
  });

  describe('sentiment/urgency', () => {
    it('should tag breaking news', () => {
      const result = extractTags('BREAKING: Fed announces emergency rate cut');
      expect(result).toContain('breaking');
    });

    it('should tag analysis', () => {
      const result = extractTags('Analyst upgrades Apple to buy');
      expect(result).toContain('analysis');
    });
  });

  describe('sectors', () => {
    it('should tag tech news', () => {
      const result = extractTags('AI chip demand drives semiconductor rally');
      expect(result).toContain('tech');
    });

    it('should tag energy news', () => {
      const result = extractTags('Oil prices rise on supply concerns');
      expect(result).toContain('energy');
    });

    it('should tag finance news', () => {
      const result = extractTags('Banks report strong lending growth');
      expect(result).toContain('finance');
    });

    it('should tag healthcare news', () => {
      const result = extractTags('FDA approves new cancer drug');
      expect(result).toContain('healthcare');
    });
  });

  describe('geography', () => {
    it('should tag Turkey news', () => {
      const result = extractTags('Borsa Istanbul hits record high');
      expect(result).toContain('turkey');
    });

    it('should tag USA news', () => {
      const result = extractTags('Wall Street rallies on Fed hopes');
      expect(result).toContain('usa');
    });

    it('should tag Europe news', () => {
      const result = extractTags('ECB signals rate pause in eurozone');
      expect(result).toContain('europe');
    });

    it('should tag Asia news', () => {
      const result = extractTags('China manufacturing data beats expectations');
      expect(result).toContain('asia');
    });
  });

  describe('multiple tags', () => {
    it('should extract multiple tags from complex headline', () => {
      const result = extractTags(
        'BREAKING: Federal Reserve raises rates amid inflation concerns, crypto markets tumble',
      );
      expect(result).toContain('breaking');
      expect(result).toContain('rates');
      expect(result).toContain('inflation');
      expect(result).toContain('crypto');
    });

    it('should extract regional and sector tags', () => {
      const result = extractTags(
        'Wall Street banks report strong earnings as tech sector leads rally',
      );
      expect(result).toContain('usa');
      expect(result).toContain('finance');
      expect(result).toContain('earnings');
      expect(result).toContain('tech');
    });
  });

  describe('edge cases', () => {
    it('should return empty array for empty string', () => {
      expect(extractTags('')).toEqual([]);
    });

    it('should return empty array for null/undefined', () => {
      expect(extractTags(null as any)).toEqual([]);
      expect(extractTags(undefined as any)).toEqual([]);
    });

    it('should handle case insensitivity', () => {
      expect(extractTags('EARNINGS report')).toContain('earnings');
      expect(extractTags('Earnings Report')).toContain('earnings');
    });

    it('should return unique tags only', () => {
      const result = extractTags('earnings earnings Q1 earnings Q2 earnings');
      const earningsCount = result.filter((t) => t === 'earnings').length;
      expect(earningsCount).toBe(1);
    });
  });

  describe('Turkish headlines', () => {
    it('should tag Turkish inflation news', () => {
      const result = extractTags(
        'TÜFE verileri enflasyonun yavaşladığını gösteriyor',
      );
      expect(result).toContain('inflation');
    });

    it('should tag Turkish rate news', () => {
      const result = extractTags('TCMB politika faizini sabit tuttu');
      expect(result).toContain('rates');
    });

    it('should tag Turkish breaking news', () => {
      const result = extractTags('Son dakika: Merkez Bankası faiz kararı');
      expect(result).toContain('breaking');
    });
  });
});

describe('combined extraction', () => {
  it('should extract both tickers and tags from headline', () => {
    const title = 'Apple earnings beat expectations as Fed signals rate pause';
    const tickers = extractTickers(title);
    const tags = extractTags(title);

    expect(tickers).toContain('AAPL');
    expect(tickers).toContain('FED');
    expect(tags).toContain('earnings');
    expect(tags).toContain('rates');
  });

  it('should handle complex Turkish headline', () => {
    const title =
      'Garanti Bankası güçlü çeyrek sonuçları açıkladı, TCMB faiz kararı bekleniyor';
    const tickers = extractTickers(title);
    const tags = extractTags(title);

    expect(tickers).toContain('GARAN');
    expect(tickers).toContain('TCMB');
    expect(tags).toContain('rates');
  });

  it('should handle crypto news', () => {
    const title =
      'Bitcoin surges past $60K as Ethereum hits new high amid crypto rally';
    const tickers = extractTickers(title);
    const tags = extractTags(title);

    expect(tickers).toContain('BTC');
    expect(tickers).toContain('ETH');
    expect(tags).toContain('crypto');
  });
});
