import { PrismaClient, Market } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed Script
 *
 * Populates the database with:
 * - Common tickers (USA S&P 500, BIST 100, CRYPTO, MACRO)
 * - Sample tags
 */

// =========================================================================
// BIST 100 - Full list
// =========================================================================
const BIST_100: Array<{ symbol: string; name: string }> = [
  { symbol: 'AEFES', name: 'Anadolu Efes Biracılık ve Malt Sanayii A.Ş.' },
  { symbol: 'AGHOL', name: 'AG Anadolu Grubu Holding A.Ş.' },
  { symbol: 'AKBNK', name: 'Akbank T.A.Ş.' },
  { symbol: 'AKCNS', name: 'Akçansa Çimento Sanayi ve Ticaret A.Ş.' },
  { symbol: 'AKFGY', name: 'Akfen Gayrimenkul Yatırım Ortaklığı A.Ş.' },
  { symbol: 'AKSA', name: 'Aksa Akrilik Kimya Sanayii A.Ş.' },
  { symbol: 'AKSEN', name: 'Aksa Enerji Üretim A.Ş.' },
  { symbol: 'ALARK', name: 'Alarko Holding A.Ş.' },
  { symbol: 'ALFAS', name: 'Alfa Solar Enerji Sanayi ve Ticaret A.Ş.' },
  { symbol: 'ARCLK', name: 'Arçelik A.Ş.' },
  { symbol: 'ARDYZ', name: 'ARD Grup Bilişim Teknolojileri A.Ş.' },
  { symbol: 'ASELS', name: 'Aselsan Elektronik Sanayi ve Ticaret A.Ş.' },
  { symbol: 'ASTOR', name: 'Astor Enerji A.Ş.' },
  { symbol: 'BERA', name: 'Bera Holding A.Ş.' },
  { symbol: 'BIMAS', name: 'BİM Birleşik Mağazalar A.Ş.' },
  { symbol: 'BIOEN', name: 'Biotrend Çevre ve Enerji Yatırımları A.Ş.' },
  { symbol: 'BRYAT', name: 'Borusan Yatırım ve Pazarlama A.Ş.' },
  { symbol: 'BUCIM', name: 'Bursa Çimento Fabrikası A.Ş.' },
  { symbol: 'CANTE', name: 'Çan2 Termik A.Ş.' },
  { symbol: 'CCOLA', name: 'Coca-Cola İçecek A.Ş.' },
  { symbol: 'CEMTS', name: 'Çemtaş Çelik Makina Sanayi ve Ticaret A.Ş.' },
  { symbol: 'CIMSA', name: 'Çimsa Çimento Sanayi ve Ticaret A.Ş.' },
  { symbol: 'CWENE', name: 'CW Enerji Mühendislik Ticaret ve Sanayi A.Ş.' },
  { symbol: 'DOAS', name: 'Doğuş Otomotiv Servis ve Ticaret A.Ş.' },
  { symbol: 'DOHOL', name: 'Doğan Şirketler Grubu Holding A.Ş.' },
  { symbol: 'ECILC', name: 'Eczacıbaşı İlaç Sınai ve Finansal Yatırımlar A.Ş.' },
  { symbol: 'EGEEN', name: 'Ege Endüstri ve Ticaret A.Ş.' },
  { symbol: 'EKGYO', name: 'Emlak Konut Gayrimenkul Yatırım Ortaklığı A.Ş.' },
  { symbol: 'ENJSA', name: 'Enerjisa Enerji A.Ş.' },
  { symbol: 'ENKAI', name: 'Enka İnşaat ve Sanayi A.Ş.' },
  { symbol: 'EREGL', name: 'Ereğli Demir ve Çelik Fabrikaları T.A.Ş.' },
  { symbol: 'EUPWR', name: 'Europower Enerji ve Otomasyon Teknolojileri A.Ş.' },
  { symbol: 'EUREN', name: 'Euro Yatırım Holding A.Ş.' },
  { symbol: 'FROTO', name: 'Ford Otomotiv Sanayi A.Ş.' },
  { symbol: 'GARAN', name: 'Türkiye Garanti Bankası A.Ş.' },
  { symbol: 'GESAN', name: 'Giresun Ticaret ve Sanayi A.Ş.' },
  { symbol: 'GUBRF', name: 'Gübre Fabrikaları T.A.Ş.' },
  { symbol: 'HALKB', name: 'Türkiye Halk Bankası A.Ş.' },
  { symbol: 'HEKTS', name: 'Hektaş Ticaret T.A.Ş.' },
  { symbol: 'ISCTR', name: 'Türkiye İş Bankası A.Ş.' },
  { symbol: 'ISGYO', name: 'İş Gayrimenkul Yatırım Ortaklığı A.Ş.' },
  { symbol: 'ISMEN', name: 'İş Yatırım Menkul Değerler A.Ş.' },
  { symbol: 'KAFEIN', name: 'Kafein Yazılım Hizmetleri A.Ş.' },
  { symbol: 'KARDEMIR', name: 'Kardemir Karabük Demir Çelik Sanayi ve Ticaret A.Ş.' },
  { symbol: 'KAYSE', name: 'Kayseri ve Civarı Elektrik T.A.Ş.' },
  { symbol: 'KCHOL', name: 'Koç Holding A.Ş.' },
  { symbol: 'KERVT', name: 'Kerevitaş Gıda Sanayi ve Ticaret A.Ş.' },
  { symbol: 'KLSER', name: 'Kaleseramik Çanakkale Kalebodur Seramik Sanayi A.Ş.' },
  { symbol: 'KONTR', name: 'Kontrolmatik Teknoloji Enerji ve Mühendislik A.Ş.' },
  { symbol: 'KONYA', name: 'Konya Çimento Sanayi A.Ş.' },
  { symbol: 'KOZAA', name: 'Koza Anadolu Metal Madencilik İşletmeleri A.Ş.' },
  { symbol: 'KOZAL', name: 'Koza Altın İşletmeleri A.Ş.' },
  { symbol: 'KRDMD', name: 'Kardemir Karabük Demir Çelik Sanayi ve Ticaret A.Ş. (D)' },
  { symbol: 'KZBGY', name: 'Kuzey Boru Gayrimenkul Yatırım Ortaklığı A.Ş.' },
  { symbol: 'MAVI', name: 'Mavi Giyim Sanayi ve Ticaret A.Ş.' },
  { symbol: 'MGROS', name: 'Migros Ticaret A.Ş.' },
  { symbol: 'MPARK', name: 'MLP Sağlık Hizmetleri A.Ş.' },
  { symbol: 'ODAS', name: 'Odaş Elektrik Üretim Sanayi Ticaret A.Ş.' },
  { symbol: 'OTKAR', name: 'Otokar Otomotiv ve Savunma Sanayi A.Ş.' },
  { symbol: 'OYAKC', name: 'OYAK Çimento Fabrikaları A.Ş.' },
  { symbol: 'PGSUS', name: 'Pegasus Hava Taşımacılığı A.Ş.' },
  { symbol: 'PETKM', name: 'Petkim Petrokimya Holding A.Ş.' },
  { symbol: 'PGSUS', name: 'Pegasus Hava Taşımacılığı A.Ş.' },
  { symbol: 'SAHOL', name: 'Hacı Ömer Sabancı Holding A.Ş.' },
  { symbol: 'SARKY', name: 'Sarkuysan Elektrolitik Bakır Sanayi ve Ticaret A.Ş.' },
  { symbol: 'SASA', name: 'SASA Polyester Sanayi A.Ş.' },
  { symbol: 'SELEC', name: 'Selçuk Ecza Deposu Ticaret ve Sanayi A.Ş.' },
  { symbol: 'SISE', name: 'Türkiye Şişe ve Cam Fabrikaları A.Ş.' },
  { symbol: 'SKBNK', name: 'Şekerbank T.A.Ş.' },
  { symbol: 'SMRTG', name: 'Smartiks Yazılım A.Ş.' },
  { symbol: 'SOKM', name: 'Şok Marketler Ticaret A.Ş.' },
  { symbol: 'TAVHL', name: 'TAV Havalimanları Holding A.Ş.' },
  { symbol: 'TCELL', name: 'Turkcell İletişim Hizmetleri A.Ş.' },
  { symbol: 'THYAO', name: 'Türk Hava Yolları A.O.' },
  { symbol: 'TKFEN', name: 'Tekfen Holding A.Ş.' },
  { symbol: 'TKNSA', name: 'Teknosa İç ve Dış Ticaret A.Ş.' },
  { symbol: 'TMSN', name: 'Tümosan Motor ve Traktör Sanayi A.Ş.' },
  { symbol: 'TOASO', name: 'Tofaş Türk Otomobil Fabrikası A.Ş.' },
  { symbol: 'TTKOM', name: 'Türk Telekomünikasyon A.Ş.' },
  { symbol: 'TTRAK', name: 'Türk Traktör ve Ziraat Makineleri A.Ş.' },
  { symbol: 'TUKAS', name: 'Tukaş Gıda Sanayi ve Ticaret A.Ş.' },
  { symbol: 'TUPRS', name: 'Tüpraş-Türkiye Petrol Rafinerileri A.Ş.' },
  { symbol: 'TURSG', name: 'Türkiye Sigorta A.Ş.' },
  { symbol: 'ULKER', name: 'Ülker Bisküvi Sanayi A.Ş.' },
  { symbol: 'VAKBN', name: 'Türkiye Vakıflar Bankası T.A.O.' },
  { symbol: 'VESBE', name: 'Vestel Beyaz Eşya Sanayi ve Ticaret A.Ş.' },
  { symbol: 'VESTL', name: 'Vestel Elektronik Sanayi ve Ticaret A.Ş.' },
  { symbol: 'YKBNK', name: 'Yapı ve Kredi Bankası A.Ş.' },
  { symbol: 'YATAS', name: 'Yataş Yatak ve Yorgan Sanayi ve Ticaret A.Ş.' },
  { symbol: 'ZOREN', name: 'Zorlu Enerji Elektrik Üretim A.Ş.' },
];

// =========================================================================
// S&P 500 - Representative list (top ~100 by market cap + key sectors)
// =========================================================================
const SP500: Array<{ symbol: string; name: string }> = [
  // Mega-cap Technology
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc. (Class A)' },
  { symbol: 'GOOG', name: 'Alphabet Inc. (Class C)' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.' },
  { symbol: 'INTU', name: 'Intuit Inc.' },
  { symbol: 'IBM', name: 'International Business Machines Corporation' },
  { symbol: 'AMAT', name: 'Applied Materials Inc.' },
  { symbol: 'NOW', name: 'ServiceNow Inc.' },
  { symbol: 'TXN', name: 'Texas Instruments Inc.' },
  { symbol: 'MU', name: 'Micron Technology Inc.' },
  { symbol: 'LRCX', name: 'Lam Research Corporation' },
  { symbol: 'KLAC', name: 'KLA Corporation' },
  { symbol: 'SNPS', name: 'Synopsys Inc.' },
  { symbol: 'CDNS', name: 'Cadence Design Systems Inc.' },
  { symbol: 'PANW', name: 'Palo Alto Networks Inc.' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.' },
  // Communication Services
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'CMCSA', name: 'Comcast Corporation' },
  { symbol: 'TMUS', name: 'T-Mobile US Inc.' },
  { symbol: 'VZ', name: 'Verizon Communications Inc.' },
  { symbol: 'T', name: 'AT&T Inc.' },
  // Financials
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'BAC', name: 'Bank of America Corporation' },
  { symbol: 'WFC', name: 'Wells Fargo & Company' },
  { symbol: 'GS', name: 'The Goldman Sachs Group Inc.' },
  { symbol: 'MS', name: 'Morgan Stanley' },
  { symbol: 'BLK', name: 'BlackRock Inc.' },
  { symbol: 'SCHW', name: 'The Charles Schwab Corporation' },
  { symbol: 'AXP', name: 'American Express Company' },
  { symbol: 'C', name: 'Citigroup Inc.' },
  { symbol: 'SPGI', name: 'S&P Global Inc.' },
  { symbol: 'CB', name: 'Chubb Limited' },
  { symbol: 'BX', name: 'Blackstone Inc.' },
  // Healthcare
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.' },
  { symbol: 'ABT', name: 'Abbott Laboratories' },
  { symbol: 'DHR', name: 'Danaher Corporation' },
  { symbol: 'BMY', name: 'Bristol-Myers Squibb Company' },
  { symbol: 'AMGN', name: 'Amgen Inc.' },
  { symbol: 'GILD', name: 'Gilead Sciences Inc.' },
  { symbol: 'ISRG', name: 'Intuitive Surgical Inc.' },
  { symbol: 'VRTX', name: 'Vertex Pharmaceuticals Inc.' },
  { symbol: 'MDT', name: 'Medtronic plc' },
  // Consumer
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'PG', name: 'The Procter & Gamble Company' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'PEP', name: 'PepsiCo Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'HD', name: 'The Home Depot Inc.' },
  { symbol: 'MCD', name: 'McDonald\'s Corporation' },
  { symbol: 'NKE', name: 'NIKE Inc.' },
  { symbol: 'SBUX', name: 'Starbucks Corporation' },
  { symbol: 'TGT', name: 'Target Corporation' },
  { symbol: 'LOW', name: 'Lowe\'s Companies Inc.' },
  { symbol: 'CL', name: 'Colgate-Palmolive Company' },
  // Industrials
  { symbol: 'CAT', name: 'Caterpillar Inc.' },
  { symbol: 'GE', name: 'GE Aerospace' },
  { symbol: 'RTX', name: 'RTX Corporation' },
  { symbol: 'HON', name: 'Honeywell International Inc.' },
  { symbol: 'UNP', name: 'Union Pacific Corporation' },
  { symbol: 'BA', name: 'The Boeing Company' },
  { symbol: 'DE', name: 'Deere & Company' },
  { symbol: 'LMT', name: 'Lockheed Martin Corporation' },
  { symbol: 'UPS', name: 'United Parcel Service Inc.' },
  { symbol: 'MMM', name: '3M Company' },
  // Energy
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'COP', name: 'ConocoPhillips' },
  { symbol: 'SLB', name: 'Schlumberger Limited' },
  { symbol: 'EOG', name: 'EOG Resources Inc.' },
  // Utilities & Real Estate
  { symbol: 'NEE', name: 'NextEra Energy Inc.' },
  { symbol: 'SO', name: 'The Southern Company' },
  { symbol: 'DUK', name: 'Duke Energy Corporation' },
  { symbol: 'AMT', name: 'American Tower Corporation' },
  { symbol: 'PLD', name: 'Prologis Inc.' },
  // Materials
  { symbol: 'LIN', name: 'Linde plc' },
  { symbol: 'APD', name: 'Air Products and Chemicals Inc.' },
  { symbol: 'FCX', name: 'Freeport-McMoRan Inc.' },
];

async function main() {
  console.log('🌱 Seeding database...\n');

  // =========================================================================
  // TICKERS - USA (S&P 500)
  // =========================================================================
  console.log('📈 Creating USA tickers (S&P 500)...');

  for (const ticker of SP500) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: { symbol: ticker.symbol, market: Market.USA, name: ticker.name },
      update: { name: ticker.name, market: Market.USA },
    });
  }
  console.log(`  ✅ ${SP500.length} USA tickers\n`);

  // =========================================================================
  // TICKERS - BIST 100
  // =========================================================================
  console.log('📈 Creating BIST tickers (BIST 100)...');

  for (const ticker of BIST_100) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: { symbol: ticker.symbol, market: Market.BIST, name: ticker.name },
      update: { name: ticker.name, market: Market.BIST },
    });
  }
  console.log(`  ✅ ${BIST_100.length} BIST tickers\n`);

  // =========================================================================
  // TICKERS - CRYPTO
  // =========================================================================
  console.log('🪙 Creating CRYPTO tickers...');

  const cryptoTickers = [
    // Top coins by market cap
    { symbol: 'BTC', market: Market.CRYPTO, name: 'Bitcoin' },
    { symbol: 'ETH', market: Market.CRYPTO, name: 'Ethereum' },
    { symbol: 'BNB', market: Market.CRYPTO, name: 'BNB' },
    { symbol: 'SOL', market: Market.CRYPTO, name: 'Solana' },
    { symbol: 'XRP', market: Market.CRYPTO, name: 'XRP' },
    { symbol: 'DOGE', market: Market.CRYPTO, name: 'Dogecoin' },
    { symbol: 'ADA', market: Market.CRYPTO, name: 'Cardano' },
    { symbol: 'AVAX', market: Market.CRYPTO, name: 'Avalanche' },
    { symbol: 'DOT', market: Market.CRYPTO, name: 'Polkadot' },
    { symbol: 'LINK', market: Market.CRYPTO, name: 'Chainlink' },
    { symbol: 'MATIC', market: Market.CRYPTO, name: 'Polygon' },
    { symbol: 'SHIB', market: Market.CRYPTO, name: 'Shiba Inu' },
    { symbol: 'LTC', market: Market.CRYPTO, name: 'Litecoin' },
    { symbol: 'UNI', market: Market.CRYPTO, name: 'Uniswap' },
    { symbol: 'ATOM', market: Market.CRYPTO, name: 'Cosmos' },
    { symbol: 'NEAR', market: Market.CRYPTO, name: 'NEAR Protocol' },
    { symbol: 'FIL', market: Market.CRYPTO, name: 'Filecoin' },
    { symbol: 'APT', market: Market.CRYPTO, name: 'Aptos' },
    { symbol: 'ARB', market: Market.CRYPTO, name: 'Arbitrum' },
    { symbol: 'OP', market: Market.CRYPTO, name: 'Optimism' },
    { symbol: 'IMX', market: Market.CRYPTO, name: 'Immutable X' },
    { symbol: 'INJ', market: Market.CRYPTO, name: 'Injective' },
    { symbol: 'FET', market: Market.CRYPTO, name: 'Fetch.ai' },
    { symbol: 'RNDR', market: Market.CRYPTO, name: 'Render' },
    { symbol: 'STX', market: Market.CRYPTO, name: 'Stacks' },
    // DeFi
    { symbol: 'AAVE', market: Market.CRYPTO, name: 'Aave' },
    { symbol: 'GRT', market: Market.CRYPTO, name: 'The Graph' },
    { symbol: 'MKR', market: Market.CRYPTO, name: 'Maker' },
    { symbol: 'SNX', market: Market.CRYPTO, name: 'Synthetix' },
    { symbol: 'COMP', market: Market.CRYPTO, name: 'Compound' },
    { symbol: 'CRV', market: Market.CRYPTO, name: 'Curve DAO' },
    { symbol: 'LDO', market: Market.CRYPTO, name: 'Lido DAO' },
    { symbol: 'RPL', market: Market.CRYPTO, name: 'Rocket Pool' },
    { symbol: 'DYDX', market: Market.CRYPTO, name: 'dYdX' },
    // Meme
    { symbol: 'PEPE', market: Market.CRYPTO, name: 'Pepe' },
    { symbol: 'WLD', market: Market.CRYPTO, name: 'Worldcoin' },
    { symbol: 'SUI', market: Market.CRYPTO, name: 'Sui' },
    { symbol: 'SEI', market: Market.CRYPTO, name: 'Sei' },
    { symbol: 'TIA', market: Market.CRYPTO, name: 'Celestia' },
    { symbol: 'MANTA', market: Market.CRYPTO, name: 'Manta Network' },
    { symbol: 'JUP', market: Market.CRYPTO, name: 'Jupiter' },
    { symbol: 'PYTH', market: Market.CRYPTO, name: 'Pyth Network' },
    { symbol: 'WIF', market: Market.CRYPTO, name: 'dogwifhat' },
    { symbol: 'BONK', market: Market.CRYPTO, name: 'Bonk' },
    { symbol: 'FLOKI', market: Market.CRYPTO, name: 'Floki' },
    // Major alts
    { symbol: 'TON', market: Market.CRYPTO, name: 'Toncoin' },
    { symbol: 'TRX', market: Market.CRYPTO, name: 'TRON' },
    { symbol: 'BCH', market: Market.CRYPTO, name: 'Bitcoin Cash' },
    { symbol: 'ETC', market: Market.CRYPTO, name: 'Ethereum Classic' },
    { symbol: 'XLM', market: Market.CRYPTO, name: 'Stellar' },
    { symbol: 'ALGO', market: Market.CRYPTO, name: 'Algorand' },
    { symbol: 'VET', market: Market.CRYPTO, name: 'VeChain' },
    { symbol: 'HBAR', market: Market.CRYPTO, name: 'Hedera' },
    { symbol: 'ICP', market: Market.CRYPTO, name: 'Internet Computer' },
    { symbol: 'EGLD', market: Market.CRYPTO, name: 'MultiversX' },
    { symbol: 'FTM', market: Market.CRYPTO, name: 'Fantom' },
    // Metaverse & Gaming
    { symbol: 'SAND', market: Market.CRYPTO, name: 'The Sandbox' },
    { symbol: 'MANA', market: Market.CRYPTO, name: 'Decentraland' },
    { symbol: 'AXS', market: Market.CRYPTO, name: 'Axie Infinity' },
    { symbol: 'ENJ', market: Market.CRYPTO, name: 'Enjin Coin' },
    { symbol: 'GALA', market: Market.CRYPTO, name: 'Gala' },
    // Infrastructure
    { symbol: 'THETA', market: Market.CRYPTO, name: 'Theta Network' },
    { symbol: 'RUNE', market: Market.CRYPTO, name: 'THORChain' },
    { symbol: 'KAS', market: Market.CRYPTO, name: 'Kaspa' },
    { symbol: 'QNT', market: Market.CRYPTO, name: 'Quant' },
    { symbol: 'FLOW', market: Market.CRYPTO, name: 'Flow' },
    { symbol: 'XTZ', market: Market.CRYPTO, name: 'Tezos' },
    { symbol: 'EOS', market: Market.CRYPTO, name: 'EOS' },
    { symbol: 'NEO', market: Market.CRYPTO, name: 'Neo' },
    // Privacy & Legacy
    { symbol: 'ZEC', market: Market.CRYPTO, name: 'Zcash' },
    { symbol: 'DASH', market: Market.CRYPTO, name: 'Dash' },
    { symbol: 'IOTA', market: Market.CRYPTO, name: 'IOTA' },
    { symbol: 'ONE', market: Market.CRYPTO, name: 'Harmony' },
    { symbol: 'ROSE', market: Market.CRYPTO, name: 'Oasis Network' },
    // Social & Identity
    { symbol: 'CHZ', market: Market.CRYPTO, name: 'Chiliz' },
    { symbol: 'ENS', market: Market.CRYPTO, name: 'Ethereum Name Service' },
    { symbol: 'APE', market: Market.CRYPTO, name: 'ApeCoin' },
    { symbol: 'BLUR', market: Market.CRYPTO, name: 'Blur' },
    { symbol: 'MASK', market: Market.CRYPTO, name: 'Mask Network' },
    // AI & Data
    { symbol: 'OCEAN', market: Market.CRYPTO, name: 'Ocean Protocol' },
    { symbol: 'AGIX', market: Market.CRYPTO, name: 'SingularityNET' },
    { symbol: 'CFX', market: Market.CRYPTO, name: 'Conflux' },
    { symbol: 'CKB', market: Market.CRYPTO, name: 'Nervos Network' },
    { symbol: 'ASTR', market: Market.CRYPTO, name: 'Astar' },
    // Additional
    { symbol: 'CELO', market: Market.CRYPTO, name: 'Celo' },
    { symbol: 'ZIL', market: Market.CRYPTO, name: 'Zilliqa' },
    { symbol: 'ANKR', market: Market.CRYPTO, name: 'Ankr' },
    { symbol: '1INCH', market: Market.CRYPTO, name: '1inch' },
    { symbol: 'SUSHI', market: Market.CRYPTO, name: 'SushiSwap' },
    { symbol: 'BAL', market: Market.CRYPTO, name: 'Balancer' },
    { symbol: 'YFI', market: Market.CRYPTO, name: 'yearn.finance' },
    { symbol: 'BAND', market: Market.CRYPTO, name: 'Band Protocol' },
    { symbol: 'KAVA', market: Market.CRYPTO, name: 'Kava' },
    { symbol: 'OSMO', market: Market.CRYPTO, name: 'Osmosis' },
    { symbol: 'AKT', market: Market.CRYPTO, name: 'Akash Network' },
    { symbol: 'MINA', market: Market.CRYPTO, name: 'Mina Protocol' },
    { symbol: 'ZK', market: Market.CRYPTO, name: 'zkSync' },
    { symbol: 'STRK', market: Market.CRYPTO, name: 'Starknet' },
    { symbol: 'PENDLE', market: Market.CRYPTO, name: 'Pendle' },
    { symbol: 'JTO', market: Market.CRYPTO, name: 'Jito' },
    { symbol: 'W', market: Market.CRYPTO, name: 'Wormhole' },
  ];

  for (const ticker of cryptoTickers) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: ticker,
      update: { name: ticker.name, market: ticker.market },
    });
  }
  console.log(`  ✅ ${cryptoTickers.length} CRYPTO tickers\n`);

  // =========================================================================
  // TICKERS - MACRO (Economic Indicators)
  // =========================================================================
  console.log('🏛️ Creating MACRO tickers...');

  const macroTickers = [
    { symbol: 'FED', market: Market.MACRO, name: 'Federal Reserve' },
    { symbol: 'CPI', market: Market.MACRO, name: 'Consumer Price Index' },
    { symbol: 'PPI', market: Market.MACRO, name: 'Producer Price Index' },
    { symbol: 'GDP', market: Market.MACRO, name: 'Gross Domestic Product' },
    { symbol: 'NFP', market: Market.MACRO, name: 'Non-Farm Payrolls' },
    { symbol: 'FOMC', market: Market.MACRO, name: 'Federal Open Market Committee' },
    { symbol: 'ECB', market: Market.MACRO, name: 'European Central Bank' },
    { symbol: 'TCMB', market: Market.MACRO, name: 'Türkiye Cumhuriyet Merkez Bankası' },
    { symbol: 'DXY', market: Market.MACRO, name: 'US Dollar Index' },
    { symbol: 'VIX', market: Market.MACRO, name: 'CBOE Volatility Index' },
  ];

  for (const ticker of macroTickers) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: ticker,
      update: { name: ticker.name, market: ticker.market },
    });
  }
  console.log(`  ✅ ${macroTickers.length} MACRO tickers\n`);

  // =========================================================================
  // TICKERS - FOREX
  // =========================================================================
  console.log('💱 Creating FOREX tickers...');

  const forexTickers = [
    { symbol: 'USDTRY=X', market: Market.FOREX, name: 'USD/TRY' },
    { symbol: 'EURTRY=X', market: Market.FOREX, name: 'EUR/TRY' },
    { symbol: 'GBPTRY=X', market: Market.FOREX, name: 'GBP/TRY' },
    { symbol: 'EURUSD=X', market: Market.FOREX, name: 'EUR/USD' },
    { symbol: 'GBPUSD=X', market: Market.FOREX, name: 'GBP/USD' },
    { symbol: 'USDJPY=X', market: Market.FOREX, name: 'USD/JPY' },
    { symbol: 'USDCHF=X', market: Market.FOREX, name: 'USD/CHF' },
    { symbol: 'AUDUSD=X', market: Market.FOREX, name: 'AUD/USD' },
    { symbol: 'NZDUSD=X', market: Market.FOREX, name: 'NZD/USD' },
    { symbol: 'USDCAD=X', market: Market.FOREX, name: 'USD/CAD' },
    { symbol: 'EURGBP=X', market: Market.FOREX, name: 'EUR/GBP' },
    { symbol: 'EURJPY=X', market: Market.FOREX, name: 'EUR/JPY' },
    { symbol: 'GBPJPY=X', market: Market.FOREX, name: 'GBP/JPY' },
    { symbol: 'USDCNY=X', market: Market.FOREX, name: 'USD/CNY' },
    { symbol: 'USDINR=X', market: Market.FOREX, name: 'USD/INR' },
  ];

  for (const ticker of forexTickers) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: ticker,
      update: { name: ticker.name, market: ticker.market },
    });
  }
  console.log(`  ✅ ${forexTickers.length} FOREX tickers\n`);

  // =========================================================================
  // TICKERS - COMMODITY
  // =========================================================================
  console.log('🛢️ Creating COMMODITY tickers...');

  const commodityTickers = [
    { symbol: 'GC=F', market: Market.COMMODITY, name: 'Gold Futures' },
    { symbol: 'SI=F', market: Market.COMMODITY, name: 'Silver Futures' },
    { symbol: 'CL=F', market: Market.COMMODITY, name: 'Crude Oil WTI Futures' },
    { symbol: 'BZ=F', market: Market.COMMODITY, name: 'Brent Crude Oil Futures' },
    { symbol: 'HG=F', market: Market.COMMODITY, name: 'Copper Futures' },
    { symbol: 'NG=F', market: Market.COMMODITY, name: 'Natural Gas Futures' },
    { symbol: 'PL=F', market: Market.COMMODITY, name: 'Platinum Futures' },
    { symbol: 'PA=F', market: Market.COMMODITY, name: 'Palladium Futures' },
    { symbol: 'ZC=F', market: Market.COMMODITY, name: 'Corn Futures' },
    { symbol: 'ZW=F', market: Market.COMMODITY, name: 'Wheat Futures' },
    { symbol: 'ZS=F', market: Market.COMMODITY, name: 'Soybean Futures' },
    { symbol: 'KC=F', market: Market.COMMODITY, name: 'Coffee Futures' },
  ];

  for (const ticker of commodityTickers) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: ticker,
      update: { name: ticker.name, market: ticker.market },
    });
  }
  console.log(`  ✅ ${commodityTickers.length} COMMODITY tickers\n`);

  // =========================================================================
  // TICKERS - FUND/ETF
  // =========================================================================
  console.log('📊 Creating FUND/ETF tickers...');

  const fundTickers = [
    { symbol: 'SPY', market: Market.FUND, name: 'SPDR S&P 500 ETF Trust' },
    { symbol: 'QQQ', market: Market.FUND, name: 'Invesco QQQ Trust' },
    { symbol: 'IWM', market: Market.FUND, name: 'iShares Russell 2000 ETF' },
    { symbol: 'DIA', market: Market.FUND, name: 'SPDR Dow Jones Industrial Average ETF' },
    { symbol: 'VTI', market: Market.FUND, name: 'Vanguard Total Stock Market ETF' },
    { symbol: 'VOO', market: Market.FUND, name: 'Vanguard S&P 500 ETF' },
    { symbol: 'VEA', market: Market.FUND, name: 'Vanguard FTSE Developed Markets ETF' },
    { symbol: 'VWO', market: Market.FUND, name: 'Vanguard FTSE Emerging Markets ETF' },
    { symbol: 'GLD', market: Market.FUND, name: 'SPDR Gold Shares' },
    { symbol: 'SLV', market: Market.FUND, name: 'iShares Silver Trust' },
    { symbol: 'TLT', market: Market.FUND, name: 'iShares 20+ Year Treasury Bond ETF' },
    { symbol: 'AGG', market: Market.FUND, name: 'iShares Core U.S. Aggregate Bond ETF' },
    { symbol: 'XLF', market: Market.FUND, name: 'Financial Select Sector SPDR Fund' },
    { symbol: 'XLK', market: Market.FUND, name: 'Technology Select Sector SPDR Fund' },
    { symbol: 'XLE', market: Market.FUND, name: 'Energy Select Sector SPDR Fund' },
    { symbol: 'XLV', market: Market.FUND, name: 'Health Care Select Sector SPDR Fund' },
    { symbol: 'IBB', market: Market.FUND, name: 'iShares Biotechnology ETF' },
    { symbol: 'ARKK', market: Market.FUND, name: 'ARK Innovation ETF' },
    { symbol: 'EEM', market: Market.FUND, name: 'iShares MSCI Emerging Markets ETF' },
    { symbol: 'HYG', market: Market.FUND, name: 'iShares iBoxx $ High Yield Corporate Bond ETF' },
  ];

  for (const ticker of fundTickers) {
    await prisma.ticker.upsert({
      where: { symbol: ticker.symbol },
      create: ticker,
      update: { name: ticker.name, market: ticker.market },
    });
  }
  console.log(`  ✅ ${fundTickers.length} FUND/ETF tickers\n`);

  // =========================================================================
  // TAGS - Common categories
  // =========================================================================
  console.log('🏷️ Creating tags...');

  const tags = [
    'earnings',
    'merger',
    'acquisition',
    'ipo',
    'dividend',
    'buyback',
    'layoffs',
    'lawsuit',
    'regulation',
    'sec-filing',
    'fed',
    'inflation',
    'interest-rates',
    'crypto',
    'ai',
    'tech',
    'energy',
    'finance',
    'healthcare',
    'turkey',
    'usa',
    'europe',
    'asia',
    'breaking',
    'analysis',
  ];

  for (const name of tags) {
    await prisma.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }
  console.log(`  ✅ ${tags.length} tags\n`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  const tickerCount = await prisma.ticker.count();
  const tagCount = await prisma.tag.count();
  const bistCount = await prisma.ticker.count({ where: { market: Market.BIST } });
  const usaCount = await prisma.ticker.count({ where: { market: Market.USA } });

  console.log('═'.repeat(50));
  console.log('✨ Seeding complete!\n');
  console.log(`   📈 ${tickerCount} tickers total`);
  console.log(`      - USA (S&P 500): ${usaCount}`);
  console.log(`      - BIST 100: ${bistCount}`);
  console.log(`      - CRYPTO: ${cryptoTickers.length}`);
  console.log(`      - MACRO: ${macroTickers.length}`);
  console.log(`      - FOREX: ${forexTickers.length}`);
  console.log(`      - COMMODITY: ${commodityTickers.length}`);
  console.log(`      - FUND/ETF: ${fundTickers.length}`);
  console.log(`   🏷️  ${tagCount} tags`);
  console.log('═'.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
