import { 
  PrismaClient, 
  AssetType, 
  AccountType, 
  TradeType,
  Currency, 
  PriceSource 
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

async function main() {
  console.log('🌱 Seeding database...\n');

  // ---------------------------------------------------------------------------
  // 1. Create default user
  // ---------------------------------------------------------------------------
  const email = process.env.DEFAULT_USER_EMAIL || 'admin@finans.local';
  const password = process.env.DEFAULT_USER_PASSWORD || 'changeme123';
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password: passwordHash,
      name: 'Admin',
      baseCurrency: Currency.TRY,
    },
  });
  console.log(`✅ User: ${user.email}`);

  // ---------------------------------------------------------------------------
  // 2. Create common assets
  // ---------------------------------------------------------------------------
  const assetsData = [
    // US Stocks
    { symbol: 'AAPL', name: 'Apple Inc.', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'MSFT', name: 'Microsoft Corporation', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'META', name: 'Meta Platforms Inc.', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: AssetType.stock, exchange: 'NASDAQ', currency: Currency.USD },
    
    // BIST Stocks
    { symbol: 'THYAO', name: 'Türk Hava Yolları', type: AssetType.stock, exchange: 'BIST', currency: Currency.TRY },
    { symbol: 'GARAN', name: 'Garanti BBVA', type: AssetType.stock, exchange: 'BIST', currency: Currency.TRY },
    { symbol: 'AKBNK', name: 'Akbank', type: AssetType.stock, exchange: 'BIST', currency: Currency.TRY },
    { symbol: 'SISE', name: 'Şişe Cam', type: AssetType.stock, exchange: 'BIST', currency: Currency.TRY },
    { symbol: 'KCHOL', name: 'Koç Holding', type: AssetType.stock, exchange: 'BIST', currency: Currency.TRY },
    
    // Crypto
    { symbol: 'BTC', name: 'Bitcoin', type: AssetType.crypto, exchange: 'CRYPTO', currency: Currency.USD },
    { symbol: 'ETH', name: 'Ethereum', type: AssetType.crypto, exchange: 'CRYPTO', currency: Currency.USD },
    { symbol: 'SOL', name: 'Solana', type: AssetType.crypto, exchange: 'CRYPTO', currency: Currency.USD },
    { symbol: 'BNB', name: 'BNB', type: AssetType.crypto, exchange: 'CRYPTO', currency: Currency.USD },
    { symbol: 'XRP', name: 'Ripple', type: AssetType.crypto, exchange: 'CRYPTO', currency: Currency.USD },
    { symbol: 'ADA', name: 'Cardano', type: AssetType.crypto, exchange: 'CRYPTO', currency: Currency.USD },
    
    // ETFs
    { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', type: AssetType.etf, exchange: 'NYSE', currency: Currency.USD },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', type: AssetType.etf, exchange: 'NASDAQ', currency: Currency.USD },
    { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', type: AssetType.etf, exchange: 'NYSE', currency: Currency.USD },
  ];

  const assets: Record<string, { id: string }> = {};
  for (const asset of assetsData) {
    const created = await prisma.asset.upsert({
      where: { symbol_exchange: { symbol: asset.symbol, exchange: asset.exchange } },
      update: {},
      create: asset,
    });
    assets[asset.symbol] = created;
  }
  console.log(`✅ Assets: ${assetsData.length} created`);

  // ---------------------------------------------------------------------------
  // 3. Create sample accounts
  // ---------------------------------------------------------------------------
  let ibAccount = await prisma.account.findFirst({ 
    where: { userId: user.id, name: 'Interactive Brokers' } 
  });
  
  if (!ibAccount) {
    ibAccount = await prisma.account.create({
      data: {
        name: 'Interactive Brokers',
        type: AccountType.brokerage,
        currency: Currency.USD,
        userId: user.id,
        institution: 'Interactive Brokers LLC',
      },
    });
  }

  let binanceAccount = await prisma.account.findFirst({ 
    where: { userId: user.id, name: 'Binance' } 
  });
  
  if (!binanceAccount) {
    binanceAccount = await prisma.account.create({
      data: {
        name: 'Binance',
        type: AccountType.crypto_exchange,
        currency: Currency.USD,
        userId: user.id,
      },
    });
  }

  let garantiAccount = await prisma.account.findFirst({ 
    where: { userId: user.id, name: 'Garanti Yatırım' } 
  });
  
  if (!garantiAccount) {
    garantiAccount = await prisma.account.create({
      data: {
        name: 'Garanti Yatırım',
        type: AccountType.brokerage,
        currency: Currency.TRY,
        userId: user.id,
        institution: 'Garanti BBVA',
      },
    });
  }

  console.log(`✅ Accounts: 3 created`);

  // ---------------------------------------------------------------------------
  // 4. Create sample trades
  // ---------------------------------------------------------------------------
  const existingTrades = await prisma.trade.count({ where: { account: { userId: user.id } } });
  
  if (existingTrades === 0) {
    const tradesData = [
      // AAPL trades
      {
        accountId: ibAccount.id,
        assetId: assets['AAPL'].id,
        type: TradeType.buy,
        quantity: 50,
        price: 142.50,
        fees: 1.00,
        currency: Currency.USD,
        executedAt: new Date('2024-03-15'),
      },
      {
        accountId: ibAccount.id,
        assetId: assets['AAPL'].id,
        type: TradeType.buy,
        quantity: 100,
        price: 168.00,
        fees: 1.00,
        currency: Currency.USD,
        executedAt: new Date('2024-08-20'),
      },
      {
        accountId: ibAccount.id,
        assetId: assets['AAPL'].id,
        type: TradeType.dividend,
        quantity: 150, // 150 shares
        price: 0.25, // $0.25 per share
        fees: 0,
        currency: Currency.USD,
        executedAt: new Date('2024-11-15'),
        notes: 'Q3 2024 Dividend',
      },

      // MSFT trades
      {
        accountId: ibAccount.id,
        assetId: assets['MSFT'].id,
        type: TradeType.buy,
        quantity: 75,
        price: 285.40,
        fees: 1.00,
        currency: Currency.USD,
        executedAt: new Date('2024-05-10'),
      },

      // NVDA trades
      {
        accountId: ibAccount.id,
        assetId: assets['NVDA'].id,
        type: TradeType.buy,
        quantity: 25,
        price: 420.00,
        fees: 1.00,
        currency: Currency.USD,
        executedAt: new Date('2024-06-01'),
      },

      // VOO ETF
      {
        accountId: ibAccount.id,
        assetId: assets['VOO'].id,
        type: TradeType.buy,
        quantity: 20,
        price: 450.00,
        fees: 0,
        currency: Currency.USD,
        executedAt: new Date('2024-04-01'),
      },

      // BTC trades
      {
        accountId: binanceAccount.id,
        assetId: assets['BTC'].id,
        type: TradeType.buy,
        quantity: 0.5,
        price: 42000.00,
        fees: 21.00,
        currency: Currency.USD,
        executedAt: new Date('2024-02-10'),
      },
      {
        accountId: binanceAccount.id,
        assetId: assets['BTC'].id,
        type: TradeType.buy,
        quantity: 0.25,
        price: 65000.00,
        fees: 16.25,
        currency: Currency.USD,
        executedAt: new Date('2024-10-15'),
      },

      // ETH trades
      {
        accountId: binanceAccount.id,
        assetId: assets['ETH'].id,
        type: TradeType.buy,
        quantity: 5,
        price: 2200.00,
        fees: 11.00,
        currency: Currency.USD,
        executedAt: new Date('2024-03-01'),
      },
      {
        accountId: binanceAccount.id,
        assetId: assets['ETH'].id,
        type: TradeType.sell,
        quantity: 2,
        price: 3500.00,
        fees: 7.00,
        currency: Currency.USD,
        executedAt: new Date('2024-12-05'),
        notes: 'Partial profit taking',
      },

      // SOL trade
      {
        accountId: binanceAccount.id,
        assetId: assets['SOL'].id,
        type: TradeType.buy,
        quantity: 50,
        price: 95.00,
        fees: 4.75,
        currency: Currency.USD,
        executedAt: new Date('2024-07-20'),
      },

      // BIST trades
      {
        accountId: garantiAccount.id,
        assetId: assets['THYAO'].id,
        type: TradeType.buy,
        quantity: 500,
        price: 280.50,
        fees: 140.25,
        currency: Currency.TRY,
        executedAt: new Date('2024-04-15'),
      },
      {
        accountId: garantiAccount.id,
        assetId: assets['GARAN'].id,
        type: TradeType.buy,
        quantity: 1000,
        price: 95.20,
        fees: 95.20,
        currency: Currency.TRY,
        executedAt: new Date('2024-05-20'),
      },
    ];

    for (const trade of tradesData) {
      const baseAmount = trade.quantity * trade.price;
      let total: number;
      
      switch (trade.type) {
        case TradeType.buy:
          total = baseAmount + trade.fees;
          break;
        case TradeType.sell:
          total = baseAmount - trade.fees;
          break;
        case TradeType.dividend:
        default:
          total = baseAmount;
      }

      await prisma.trade.create({
        data: {
          ...trade,
          total,
        },
      });
    }
    console.log(`✅ Trades: ${tradesData.length} created`);
  } else {
    console.log(`⏭️  Trades: ${existingTrades} already exist`);
  }

  // ---------------------------------------------------------------------------
  // 5. Create default watchlists
  // ---------------------------------------------------------------------------
  const existingWatchlists = await prisma.watchlist.count({ where: { userId: user.id } });
  
  if (existingWatchlists === 0) {
    const techWatchlist = await prisma.watchlist.create({
      data: {
        name: 'US Tech',
        description: 'US technology stocks',
        userId: user.id,
      },
    });

    // Add items to tech watchlist
    for (const symbol of ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META', 'TSLA']) {
      await prisma.watchlistItem.create({
        data: {
          watchlistId: techWatchlist.id,
          assetId: assets[symbol].id,
        },
      });
    }

    const cryptoWatchlist = await prisma.watchlist.create({
      data: {
        name: 'Crypto',
        description: 'Cryptocurrency watchlist',
        userId: user.id,
      },
    });

    for (const symbol of ['BTC', 'ETH', 'SOL', 'BNB']) {
      await prisma.watchlistItem.create({
        data: {
          watchlistId: cryptoWatchlist.id,
          assetId: assets[symbol].id,
        },
      });
    }

    const bistWatchlist = await prisma.watchlist.create({
      data: {
        name: 'BIST Favorites',
        description: 'Turkish market watchlist',
        userId: user.id,
      },
    });

    for (const symbol of ['THYAO', 'GARAN', 'AKBNK', 'SISE', 'KCHOL']) {
      await prisma.watchlistItem.create({
        data: {
          watchlistId: bistWatchlist.id,
          assetId: assets[symbol].id,
        },
      });
    }

    console.log(`✅ Watchlists: 3 created with items`);
  } else {
    console.log(`⏭️  Watchlists: ${existingWatchlists} already exist`);
  }

  // ---------------------------------------------------------------------------
  // 6. Create RSS sources
  // ---------------------------------------------------------------------------
  const rssSources = [
    { name: 'Reuters Business', url: 'https://feeds.reuters.com/reuters/businessNews', category: 'Economy', tags: ['economy', 'business'] },
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'Crypto', tags: ['crypto', 'bitcoin'] },
    { name: 'Bloomberg Markets', url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'Markets', tags: ['markets', 'stocks'] },
    { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'Markets', tags: ['markets', 'finance'] },
  ];

  for (const source of rssSources) {
    await prisma.rssSource.upsert({
      where: { userId_url: { userId: user.id, url: source.url } },
      update: {},
      create: { ...source, userId: user.id },
    });
  }
  console.log(`✅ RSS Sources: ${rssSources.length} created`);

  // ---------------------------------------------------------------------------
  // 7. Create sample prices for portfolio calculations
  // ---------------------------------------------------------------------------
  const now = new Date();
  
  const pricesData = [
    // US Stocks - current prices
    { symbol: 'AAPL', price: 185.50 },
    { symbol: 'MSFT', price: 378.90 },
    { symbol: 'NVDA', price: 495.20 },
    { symbol: 'VOO', price: 478.50 },
    // Crypto - current prices
    { symbol: 'BTC', price: 95000.00 },
    { symbol: 'ETH', price: 3400.00 },
    { symbol: 'SOL', price: 195.00 },
    // BIST - current prices (TRY)
    { symbol: 'THYAO', price: 320.50 },
    { symbol: 'GARAN', price: 112.80 },
  ];

  for (const priceData of pricesData) {
    const asset = assets[priceData.symbol];
    if (asset) {
      await prisma.price.upsert({
        where: {
          assetId_timestamp: {
            assetId: asset.id,
            timestamp: now,
          },
        },
        update: { close: priceData.price },
        create: {
          assetId: asset.id,
          open: priceData.price,
          high: priceData.price,
          low: priceData.price,
          close: priceData.price,
          timestamp: now,
          source: PriceSource.manual,
        },
      });
    }
  }
  console.log(`✅ Prices: ${pricesData.length} created`);

  // ---------------------------------------------------------------------------
  // 8. Create sample FX rates
  // ---------------------------------------------------------------------------
  const fxRates = [
    { fromCurrency: Currency.USD, toCurrency: Currency.TRY, rate: 30.50, timestamp: now },
    { fromCurrency: Currency.EUR, toCurrency: Currency.TRY, rate: 33.20, timestamp: now },
    { fromCurrency: Currency.GBP, toCurrency: Currency.TRY, rate: 38.50, timestamp: now },
    { fromCurrency: Currency.EUR, toCurrency: Currency.USD, rate: 1.09, timestamp: now },
  ];

  for (const rate of fxRates) {
    await prisma.fxRate.upsert({
      where: {
        fromCurrency_toCurrency_timestamp: {
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          timestamp: rate.timestamp,
        },
      },
      update: { rate: rate.rate },
      create: { ...rate, source: PriceSource.manual },
    });
  }
  console.log(`✅ FX Rates: ${fxRates.length} created`);

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(50));
  console.log('✅ Seeding complete!');
  console.log('='.repeat(50));
  console.log('\n📝 Login credentials:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log('\n📊 Sample data created:');
  console.log('   - 3 accounts (IB, Binance, Garanti)');
  console.log('   - 21 assets (US stocks, BIST, Crypto, ETFs)');
  console.log('   - 14 sample trades');
  console.log('   - 9 current prices');
  console.log('   - 3 watchlists with items');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
