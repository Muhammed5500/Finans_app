/* =============================================================================
   AI MODULE SEED SCRIPT
   =============================================================================
   Seeds initial data for AI module testing and development
   ============================================================================= */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// Helper alias
const uuidv4 = randomUUID;

async function main() {
  console.log('🌱 Seeding AI module data...');

  // ===========================================================================
  // 1. Create or get user
  // ===========================================================================
  let user = await prisma.user.findFirst();
  if (!user) {
    // User model uses cuid(), but we'll let Prisma generate it
    user = await prisma.user.create({
      data: {
        email: 'demo@example.com',
        name: 'Demo User',
        baseCurrency: 'TRY',
        locale: 'en-US',
      },
    });
    console.log('✅ Created user:', user.id);
  } else {
    // Update user with locale if missing
    if (!user.locale) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { locale: 'en-US' },
      });
    }
    console.log('✅ Using existing user:', user.id);
  }

  // ===========================================================================
  // 2. Create news sources
  // ===========================================================================
  const sources = [
    {
      id: uuidv4(),
      userId: user.id,
      name: 'Reuters Finance',
      type: 'rss' as const,
      baseUrl: 'https://www.reuters.com',
      url: 'https://www.reuters.com/finance',
      description: 'Reuters financial news RSS feed',
      enabled: true,
    },
    {
      id: uuidv4(),
      userId: user.id,
      name: 'Bloomberg Markets',
      type: 'rss' as const,
      baseUrl: 'https://www.bloomberg.com',
      url: 'https://www.bloomberg.com/feeds/markets',
      description: 'Bloomberg markets RSS feed',
      enabled: true,
    },
    {
      id: uuidv4(),
      userId: user.id,
      name: 'CoinDesk',
      type: 'rss' as const,
      baseUrl: 'https://www.coindesk.com',
      url: 'https://www.coindesk.com/feed',
      description: 'CoinDesk cryptocurrency news',
      enabled: true,
    },
  ];

  for (const sourceData of sources) {
    const existing = await prisma.newsSource.findUnique({
      where: { id: sourceData.id },
    });
    if (!existing) {
      await prisma.newsSource.create({ data: sourceData });
      console.log(`✅ Created news source: ${sourceData.name}`);
    }
  }

  // ===========================================================================
  // 3. Create sample raw news items
  // ===========================================================================
  const source = await prisma.newsSource.findFirst({
    where: { name: 'Reuters Finance' },
  });

  if (source) {
    const rawItems = [
      {
        id: uuidv4(),
        sourceId: source.id,
        url: 'https://www.reuters.com/article/example-1',
        titleRaw: 'Federal Reserve Signals Potential Rate Cuts in Second Half',
        contentRaw: 'The Federal Reserve indicated on Wednesday that it may consider cutting interest rates in the second half of the year as inflation shows signs of cooling...',
        publishedAtRaw: '2024-01-15T10:30:00Z',
        languageGuess: 'en',
        hashDedup: 'hash_' + Date.now() + '_1',
      },
      {
        id: uuidv4(),
        sourceId: source.id,
        url: 'https://www.reuters.com/article/example-2',
        titleRaw: 'Tech Stocks Rally on Strong Earnings Reports',
        contentRaw: 'Major technology companies reported stronger-than-expected earnings, driving a rally in tech stocks across major indices...',
        publishedAtRaw: '2024-01-15T14:20:00Z',
        languageGuess: 'en',
        hashDedup: 'hash_' + Date.now() + '_2',
      },
      {
        id: uuidv4(),
        sourceId: source.id,
        url: 'https://www.reuters.com/article/example-3',
        titleRaw: 'Bitcoin Reaches New High Amid Institutional Interest',
        contentRaw: 'Bitcoin surged to new heights as institutional investors showed increased interest in cryptocurrency assets...',
        publishedAtRaw: '2024-01-15T16:45:00Z',
        languageGuess: 'en',
        hashDedup: 'hash_' + Date.now() + '_3',
      },
    ];

    for (const rawData of rawItems) {
      const existing = await prisma.newsItemRaw.findUnique({
        where: { hashDedup: rawData.hashDedup },
      });
      if (!existing) {
        await prisma.newsItemRaw.create({ data: rawData });
        console.log(`✅ Created raw news item: ${rawData.titleRaw.substring(0, 50)}...`);
      }
    }
  }

  // ===========================================================================
  // 4. Create cleaned news items
  // ===========================================================================
  const rawItems = await prisma.newsItemRaw.findMany({
    take: 3,
  });

  for (const rawItem of rawItems) {
    const existing = await prisma.newsItemClean.findUnique({
      where: { rawId: rawItem.id },
    });
    if (!existing) {
      const cleanItem = await prisma.newsItemClean.create({
        data: {
          id: randomUUID(),
          rawId: rawItem.id,
          title: rawItem.titleRaw,
          content: rawItem.contentRaw || null,
          publishedAt: new Date(rawItem.publishedAtRaw || Date.now()),
          language: rawItem.languageGuess || 'en',
          tickers: extractTickers(rawItem.titleRaw + ' ' + (rawItem.contentRaw || '')),
          markets: extractMarkets(rawItem.titleRaw + ' ' + (rawItem.contentRaw || '')),
        },
      });
      console.log(`✅ Created cleaned news item: ${cleanItem.title.substring(0, 50)}...`);
    }
  }

  // ===========================================================================
  // 5. Create portfolio snapshot (with proper structure for profile inference)
  // ===========================================================================
  const existingSnapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId: user.id },
  });

  if (!existingSnapshot) {
    const snapshot = await prisma.portfolioSnapshot.create({
      data: {
        id: randomUUID(),
        userId: user.id,
        holdingsJson: {
          holdings: [
            {
              symbol: 'AAPL',
              name: 'Apple Inc.',
              type: 'stock',
              quantity: 150,
              value: 27888,
              currency: 'USD',
            },
            {
              symbol: 'MSFT',
              name: 'Microsoft Corporation',
              type: 'stock',
              quantity: 75,
              value: 28418.25,
              currency: 'USD',
            },
            {
              symbol: 'BTC',
              name: 'Bitcoin',
              type: 'crypto',
              quantity: 0.85,
              value: 36422.5,
              currency: 'USD',
            },
            {
              symbol: 'THYAO',
              name: 'Türk Hava Yolları',
              type: 'stock',
              quantity: 500,
              value: 12500,
              currency: 'TRY',
            },
          ],
          totalValue: 105228.75,
          cashBalance: 15000, // 15k cash
          baseCurrency: user.baseCurrency || 'TRY',
        },
      },
    });
    console.log('✅ Created portfolio snapshot:', snapshot.id);
  } else {
    console.log('✅ Portfolio snapshot already exists');
  }

  // ===========================================================================
  // 6. Create mock questionnaire (stored as JSON in a separate table or user metadata)
  // For now, we'll store it in a way that can be retrieved
  // Note: In production, this would be in a separate questionnaire table
  // ===========================================================================
  const mockQuestionnaire = {
    risk_tolerance: 'medium',
    investment_goal: 'Long-term wealth building',
    time_horizon: 'long',
    experience_level: 'intermediate',
    preferred_asset_types: ['stocks', 'crypto'],
    investment_philosophy: 'Growth-oriented with some diversification',
  };

  // Store questionnaire in user metadata or a separate table
  // For now, we'll note it exists and can be passed to the API
  console.log('✅ Mock questionnaire data prepared:', JSON.stringify(mockQuestionnaire, null, 2));

  console.log('✨ AI module seeding completed!');
}

// Helper functions
function extractTickers(text: string): string[] {
  const tickers: string[] = [];
  const tickerPattern = /\b([A-Z]{2,5})\b/g;
  const matches = text.match(tickerPattern);
  if (matches) {
    tickers.push(...matches.filter((t) => t.length >= 2 && t.length <= 5));
  }
  return [...new Set(tickers)].slice(0, 5); // Deduplicate and limit
}

function extractMarkets(text: string): string[] {
  const markets: string[] = [];
  const lowerText = text.toLowerCase();
  if (lowerText.includes('bitcoin') || lowerText.includes('crypto')) {
    markets.push('Crypto');
  }
  if (lowerText.includes('nasdaq') || lowerText.includes('s&p') || lowerText.includes('dow')) {
    markets.push('US');
  }
  if (lowerText.includes('bist') || lowerText.includes('istanbul')) {
    markets.push('BIST');
  }
  return markets.length > 0 ? markets : ['General'];
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
