import { Request, Response } from 'express';
import {
  createBinanceService,
  isValidSymbol,
  isValidInterval,
  BINANCE_KLINE_INTERVALS,
} from '../services/binance';
import { AppError } from '../utils/errors';
import {
  DEFAULT_SYMBOLS,
  DEFAULT_INTERVAL,
  DEFAULT_KLINES_LIMIT,
  mapSymbolAlias,
  mapSymbols,
} from '../config/crypto';

// Singleton service instance
const binanceService = createBinanceService();

/**
 * Helper to send success response
 */
function sendSuccess(res: Response, result: unknown): void {
  res.json({ ok: true, result });
}

/**
 * Validate a mapped symbol and throw AppError if invalid
 */
function validateSymbol(rawSymbol: string, mappedSymbol: string): void {
  if (!isValidSymbol(mappedSymbol)) {
    throw new AppError(
      400,
      `Invalid symbol: "${rawSymbol}" (mapped to "${mappedSymbol}"). Must be 5-20 uppercase alphanumeric characters ending with USDT (e.g., BTCUSDT or BTC)`,
      'INVALID_SYMBOL'
    );
  }
}

/**
 * GET /api/crypto/price?symbol=BTCUSDT
 * Also accepts: ?symbol=BTC (maps to BTCUSDT)
 */
export async function getPrice(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const mappedSymbol = mapSymbolAlias(rawSymbol);

  // Validate after mapping
  validateSymbol(rawSymbol, mappedSymbol);

  const result = await binanceService.getPrice(mappedSymbol);
  sendSuccess(res, result);
}

/**
 * GET /api/crypto/prices?symbols=BTCUSDT,ETHUSDT,BNBUSDT
 * Also accepts: ?symbols=BTC,ETH,BNB (maps to BTCUSDT,ETHUSDT,BNBUSDT)
 * If symbols not provided, returns default list
 */
export async function getPrices(req: Request, res: Response): Promise<void> {
  const { symbols } = req.query;

  let symbolList: string[];

  if (!symbols || typeof symbols !== 'string' || symbols.trim() === '') {
    // Use default list (already full pairs)
    symbolList = [...DEFAULT_SYMBOLS];
  } else {
    // Map aliases to full pairs
    symbolList = mapSymbols(symbols);

    if (symbolList.length === 0) {
      symbolList = [...DEFAULT_SYMBOLS];
    }

    // Validate each mapped symbol
    const invalidSymbols: string[] = [];
    const rawSymbols = symbols.split(',').map((s) => s.trim()).filter(Boolean);

    symbolList.forEach((mapped, index) => {
      if (!isValidSymbol(mapped)) {
        invalidSymbols.push(`${rawSymbols[index]} -> ${mapped}`);
      }
    });

    if (invalidSymbols.length > 0) {
      throw new AppError(
        400,
        `Invalid symbol(s): ${invalidSymbols.join(', ')}. Each must be valid (e.g., BTC, BTCUSDT)`,
        'INVALID_SYMBOL'
      );
    }
  }

  const results = await binanceService.getPrices(symbolList);
  sendSuccess(res, results);
}

/**
 * GET /api/crypto/24hr?symbol=BTCUSDT
 * Also accepts: ?symbol=BTC (maps to BTCUSDT)
 */
export async function get24hr(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const mappedSymbol = mapSymbolAlias(rawSymbol);

  // Validate after mapping
  validateSymbol(rawSymbol, mappedSymbol);

  const result = await binanceService.get24hr(mappedSymbol);
  sendSuccess(res, result);
}

/**
 * GET /api/crypto/klines?symbol=BTCUSDT&interval=1h&limit=100
 * Also accepts: ?symbol=BTC (maps to BTCUSDT)
 * Defaults: interval=1h, limit=100
 */
export async function getKlines(req: Request, res: Response): Promise<void> {
  const { symbol, interval, limit } = req.query;

  // Validate symbol
  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const mappedSymbol = mapSymbolAlias(rawSymbol);

  // Validate after mapping
  validateSymbol(rawSymbol, mappedSymbol);

  // Use default interval if not provided
  let resolvedInterval = DEFAULT_INTERVAL;
  if (interval && typeof interval === 'string' && interval.trim() !== '') {
    resolvedInterval = interval.trim().toLowerCase();
  }

  if (!isValidInterval(resolvedInterval)) {
    throw new AppError(
      400,
      `Invalid interval: "${interval}". Valid intervals: ${BINANCE_KLINE_INTERVALS.join(', ')}`,
      'INVALID_INTERVAL'
    );
  }

  // Use default limit if not provided
  let parsedLimit = DEFAULT_KLINES_LIMIT;

  if (limit !== undefined && limit !== '') {
    if (typeof limit !== 'string') {
      throw new AppError(400, 'Invalid limit parameter', 'INVALID_PARAM');
    }

    parsedLimit = parseInt(limit, 10);

    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
      throw new AppError(
        400,
        `Invalid limit: "${limit}". Must be a number between 1 and 1000`,
        'INVALID_LIMIT'
      );
    }
  }

  const result = await binanceService.getKlines(mappedSymbol, resolvedInterval, parsedLimit);
  sendSuccess(res, result);
}

// Crypto names lookup
const CRYPTO_NAMES: Record<string, { name: string; description: string }> = {
  // Top coins
  BTC: { name: 'Bitcoin', description: 'The original cryptocurrency, launched in 2009 by Satoshi Nakamoto. A decentralized peer-to-peer digital currency.' },
  ETH: { name: 'Ethereum', description: 'A decentralized platform that enables smart contracts and decentralized applications (dApps).' },
  BNB: { name: 'BNB', description: 'The native cryptocurrency of the Binance ecosystem, used for trading fee discounts and various utilities.' },
  SOL: { name: 'Solana', description: 'A high-performance blockchain supporting builders around the world creating crypto apps.' },
  XRP: { name: 'XRP', description: 'Digital asset built for payments, enabling fast, low-cost cross-border transactions.' },
  DOGE: { name: 'Dogecoin', description: 'Originally created as a meme cryptocurrency, now one of the most popular digital currencies.' },
  ADA: { name: 'Cardano', description: 'A proof-of-stake blockchain platform with a research-driven approach to development.' },
  AVAX: { name: 'Avalanche', description: 'A platform for launching decentralized applications and enterprise blockchain deployments.' },
  DOT: { name: 'Polkadot', description: 'A heterogeneous multi-chain protocol allowing diverse blockchains to interoperate.' },
  LINK: { name: 'Chainlink', description: 'A decentralized oracle network providing real-world data to smart contracts.' },
  MATIC: { name: 'Polygon', description: 'A Layer 2 scaling solution for Ethereum, providing faster and cheaper transactions.' },
  SHIB: { name: 'Shiba Inu', description: 'A decentralized meme token that evolved into a vibrant ecosystem.' },
  LTC: { name: 'Litecoin', description: 'A peer-to-peer cryptocurrency created as a "lighter" version of Bitcoin.' },
  UNI: { name: 'Uniswap', description: 'A popular decentralized trading protocol for automated liquidity provision.' },
  ATOM: { name: 'Cosmos', description: 'An ecosystem of blockchains designed to scale and interoperate with each other.' },
  NEAR: { name: 'NEAR Protocol', description: 'A layer-one blockchain designed as a community-run cloud computing platform.' },
  FIL: { name: 'Filecoin', description: 'A decentralized storage network designed to store humanity\'s most important information.' },
  APT: { name: 'Aptos', description: 'A Layer 1 blockchain built with Move language for safe and scalable Web3 applications.' },
  ARB: { name: 'Arbitrum', description: 'An Ethereum Layer 2 scaling solution using optimistic rollups for faster, cheaper transactions.' },
  OP: { name: 'Optimism', description: 'An Ethereum Layer 2 using optimistic rollups, powering the Superchain vision.' },
  IMX: { name: 'Immutable X', description: 'A Layer 2 scaling solution for NFTs on Ethereum with zero gas fees.' },
  INJ: { name: 'Injective', description: 'A blockchain optimized for building DeFi applications with instant finality.' },
  FET: { name: 'Fetch.ai', description: 'An AI-powered blockchain platform for building autonomous agent services.' },
  RNDR: { name: 'Render', description: 'A distributed GPU rendering network for powering next-generation 3D content.' },
  STX: { name: 'Stacks', description: 'A Bitcoin Layer 2 that enables smart contracts and DeFi on Bitcoin.' },
  // DeFi
  AAVE: { name: 'Aave', description: 'A decentralized lending and borrowing protocol on Ethereum and multiple chains.' },
  GRT: { name: 'The Graph', description: 'A decentralized indexing protocol for querying blockchain data.' },
  MKR: { name: 'Maker', description: 'The governance token of MakerDAO, the protocol behind the DAI stablecoin.' },
  SNX: { name: 'Synthetix', description: 'A decentralized protocol for creating synthetic assets on Ethereum.' },
  COMP: { name: 'Compound', description: 'An algorithmic money market protocol for lending and borrowing crypto assets.' },
  CRV: { name: 'Curve DAO', description: 'A decentralized exchange optimized for stablecoin and pegged asset trading.' },
  LDO: { name: 'Lido DAO', description: 'A liquid staking protocol allowing users to stake ETH while maintaining liquidity.' },
  RPL: { name: 'Rocket Pool', description: 'A decentralized Ethereum staking protocol for node operators and stakers.' },
  DYDX: { name: 'dYdX', description: 'A decentralized exchange for perpetual trading with advanced order types.' },
  // Meme & New
  PEPE: { name: 'Pepe', description: 'A meme cryptocurrency inspired by the Pepe the Frog internet meme.' },
  WLD: { name: 'Worldcoin', description: 'A digital identity and cryptocurrency project aiming for global distribution.' },
  SUI: { name: 'Sui', description: 'A Layer 1 blockchain using the Move language for high-throughput applications.' },
  SEI: { name: 'Sei', description: 'A Layer 1 blockchain specialized for trading and DeFi applications.' },
  TIA: { name: 'Celestia', description: 'A modular blockchain network providing data availability for rollups.' },
  MANTA: { name: 'Manta Network', description: 'A modular blockchain for zero-knowledge applications.' },
  JUP: { name: 'Jupiter', description: 'The leading DEX aggregator on Solana for optimal token swaps.' },
  PYTH: { name: 'Pyth Network', description: 'A decentralized oracle providing real-time market data to DeFi protocols.' },
  WIF: { name: 'dogwifhat', description: 'A meme token on Solana featuring a Shiba Inu dog wearing a hat.' },
  BONK: { name: 'Bonk', description: 'A Solana-based meme coin created as a community-driven project.' },
  FLOKI: { name: 'Floki', description: 'A meme cryptocurrency with utility features including NFTs and DeFi.' },
  // Major alts
  TON: { name: 'Toncoin', description: 'The native token of The Open Network, originally developed by Telegram.' },
  TRX: { name: 'TRON', description: 'A blockchain platform focused on decentralized content sharing and entertainment.' },
  BCH: { name: 'Bitcoin Cash', description: 'A Bitcoin fork with larger block sizes for faster, cheaper transactions.' },
  ETC: { name: 'Ethereum Classic', description: 'The original Ethereum blockchain that maintained the unaltered history.' },
  XLM: { name: 'Stellar', description: 'A decentralized network for fast, cross-border payments and asset transfers.' },
  ALGO: { name: 'Algorand', description: 'A pure proof-of-stake blockchain with instant finality and low fees.' },
  VET: { name: 'VeChain', description: 'A blockchain platform focused on supply chain management and enterprise solutions.' },
  HBAR: { name: 'Hedera', description: 'A hashgraph-based distributed ledger for enterprise-grade applications.' },
  ICP: { name: 'Internet Computer', description: 'A blockchain that runs at web speed with unbounded capacity.' },
  EGLD: { name: 'MultiversX', description: 'A highly scalable blockchain platform using adaptive state sharding.' },
  FTM: { name: 'Fantom', description: 'A high-performance, scalable blockchain platform for DeFi and dApps.' },
  // Gaming & Metaverse
  SAND: { name: 'The Sandbox', description: 'A virtual world where players can build, own, and monetize gaming experiences.' },
  MANA: { name: 'Decentraland', description: 'A decentralized virtual reality platform powered by the Ethereum blockchain.' },
  AXS: { name: 'Axie Infinity', description: 'A blockchain-based game where players breed, raise, and battle creatures called Axies.' },
  ENJ: { name: 'Enjin Coin', description: 'A platform for creating and managing blockchain gaming assets.' },
  GALA: { name: 'Gala', description: 'A blockchain gaming platform aiming to give players ownership of their in-game items.' },
  // Infrastructure
  THETA: { name: 'Theta Network', description: 'A decentralized video delivery network powered by blockchain technology.' },
  RUNE: { name: 'THORChain', description: 'A decentralized liquidity network enabling cross-chain token swaps.' },
  KAS: { name: 'Kaspa', description: 'A proof-of-work cryptocurrency using the GHOSTDAG protocol for fast block times.' },
  QNT: { name: 'Quant', description: 'A blockchain interoperability platform connecting various distributed ledgers.' },
  FLOW: { name: 'Flow', description: 'A blockchain built for the next generation of apps, games, and digital assets.' },
  XTZ: { name: 'Tezos', description: 'A self-amending blockchain that can evolve through on-chain governance.' },
  EOS: { name: 'EOS', description: 'A blockchain platform designed for the development of decentralized applications.' },
  NEO: { name: 'Neo', description: 'A blockchain platform and cryptocurrency designed for a smart economy.' },
  // Privacy & Legacy
  ZEC: { name: 'Zcash', description: 'A privacy-focused cryptocurrency using zero-knowledge proofs.' },
  DASH: { name: 'Dash', description: 'A cryptocurrency focused on fast, cheap payments with optional privacy features.' },
  IOTA: { name: 'IOTA', description: 'A distributed ledger using Tangle technology for the Internet of Things.' },
  ONE: { name: 'Harmony', description: 'A blockchain platform designed for cross-chain interoperability.' },
  ROSE: { name: 'Oasis Network', description: 'A privacy-first blockchain platform for open finance and data.' },
  // Social & Identity
  CHZ: { name: 'Chiliz', description: 'A blockchain platform for sports and entertainment fan engagement.' },
  ENS: { name: 'Ethereum Name Service', description: 'A distributed naming system for Ethereum addresses and resources.' },
  APE: { name: 'ApeCoin', description: 'The governance and utility token for the APE ecosystem.' },
  BLUR: { name: 'Blur', description: 'An NFT marketplace and aggregator for professional traders.' },
  MASK: { name: 'Mask Network', description: 'A protocol that allows users to send encrypted messages and crypto via social media.' },
  // AI & Data
  OCEAN: { name: 'Ocean Protocol', description: 'A decentralized data exchange protocol to unlock data for AI.' },
  AGIX: { name: 'SingularityNET', description: 'A decentralized marketplace for AI services and algorithms.' },
  CFX: { name: 'Conflux', description: 'A Layer 1 blockchain using Tree-Graph consensus for high throughput.' },
  CKB: { name: 'Nervos Network', description: 'A layered blockchain network for universal applications.' },
  ASTR: { name: 'Astar', description: 'A multi-chain smart contract platform supporting multiple virtual machines.' },
  // Additional
  CELO: { name: 'Celo', description: 'A mobile-first blockchain platform making financial tools accessible to anyone.' },
  ZIL: { name: 'Zilliqa', description: 'A high-throughput blockchain platform using sharding technology.' },
  ANKR: { name: 'Ankr', description: 'A Web3 infrastructure provider offering multi-chain tools for developers.' },
  '1INCH': { name: '1inch', description: 'A DEX aggregator that finds the best rates across multiple exchanges.' },
  SUSHI: { name: 'SushiSwap', description: 'A decentralized exchange and DeFi platform with yield farming.' },
  BAL: { name: 'Balancer', description: 'An automated portfolio manager and decentralized exchange.' },
  YFI: { name: 'yearn.finance', description: 'A yield aggregator that optimizes DeFi strategies automatically.' },
  BAND: { name: 'Band Protocol', description: 'A cross-chain data oracle platform for DeFi applications.' },
  KAVA: { name: 'Kava', description: 'A Layer 1 blockchain combining Cosmos and Ethereum ecosystems.' },
  OSMO: { name: 'Osmosis', description: 'A decentralized exchange built on the Cosmos ecosystem.' },
  AKT: { name: 'Akash Network', description: 'A decentralized cloud computing marketplace.' },
  MINA: { name: 'Mina Protocol', description: 'The lightest blockchain, using zero-knowledge proofs for a fixed-size ledger.' },
  ZK: { name: 'zkSync', description: 'An Ethereum Layer 2 scaling solution using zero-knowledge rollups.' },
  STRK: { name: 'Starknet', description: 'An Ethereum Layer 2 using STARK proofs for scalability.' },
  PENDLE: { name: 'Pendle', description: 'A DeFi protocol for tokenizing and trading future yield.' },
  JTO: { name: 'Jito', description: 'A liquid staking protocol on Solana with MEV rewards.' },
  W: { name: 'Wormhole', description: 'A cross-chain messaging protocol connecting multiple blockchains.' },
};

/**
 * GET /api/crypto/detail?symbol=BTCUSDT
 * Also accepts: ?symbol=BTC (maps to BTCUSDT)
 * 
 * Get detailed information for a crypto symbol.
 * Includes: name, description, 24hr stats.
 * Note: Crypto doesn't have dividends or traditional company info.
 */
export async function getCryptoDetail(req: Request, res: Response): Promise<void> {
  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string' || symbol.trim() === '') {
    throw new AppError(400, 'Missing required query parameter: symbol', 'MISSING_PARAM');
  }

  const rawSymbol = symbol.trim();
  const mappedSymbol = mapSymbolAlias(rawSymbol);
  
  // Extract base symbol (e.g., BTC from BTCUSDT)
  const baseSymbol = mappedSymbol.replace('USDT', '');

  // Validate after mapping
  validateSymbol(rawSymbol, mappedSymbol);

  // Get 24hr ticker for price/change data
  const ticker = await binanceService.get24hr(mappedSymbol);
  
  // Get crypto name and description
  const cryptoInfo = CRYPTO_NAMES[baseSymbol] || { 
    name: baseSymbol, 
    description: `${baseSymbol}/USDT trading pair on Binance.` 
  };

  // Build detail response
  const result = {
    symbol: baseSymbol,
    fullSymbol: mappedSymbol,
    name: cryptoInfo.name,
    displayName: `${cryptoInfo.name} (${baseSymbol})`,
    
    // Exchange info
    exchange: 'Binance',
    currency: 'USDT',
    type: 'crypto',
    
    // Description
    description: cryptoInfo.description,
    
    // No company profile for crypto
    sector: 'Cryptocurrency',
    industry: 'Digital Assets',
    website: `https://www.binance.com/en/trade/${baseSymbol}_USDT`,
    
    // Crypto doesn't have dividends
    dividendRate: null,
    dividendYield: null,
    exDividendDate: null,
    dividendDate: null,
    paysDividend: false,
    dividendNote: 'Kripto paralar temettü ödemez',
    
    // 24hr statistics from ticker
    price: parseFloat(ticker.data.lastPrice),
    change: parseFloat(ticker.data.priceChange),
    changePercent: parseFloat(ticker.data.priceChangePercent),
    high24h: parseFloat(ticker.data.highPrice),
    low24h: parseFloat(ticker.data.lowPrice),
    volume24h: parseFloat(ticker.data.volume),
    quoteVolume24h: parseFloat(ticker.data.quoteVolume),
    
    // Market data (not available from Binance basic API)
    marketCap: null,
    circulatingSupply: null,
    totalSupply: null,
    
    // Note: Binance doesn't provide listing date via this API
    listingDate: null,
    listingNote: 'Liste tarihi bilgisi mevcut değil',
    
    // Metadata
    market: 'Crypto',
    source: ticker.source,
    mock: ticker.mock,
    fetchedAt: ticker.fetchedAt,
  };

  sendSuccess(res, result);
}
