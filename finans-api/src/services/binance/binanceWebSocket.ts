import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { BinanceMiniTicker } from '../../ws/types';

// Binance WebSocket base URL
const BINANCE_WS_BASE = 'wss://stream.binance.com:9443/ws';

// Reconnect settings
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_MULTIPLIER = 2;

// Ping interval to keep connection alive
const PING_INTERVAL_MS = 30000;

export interface PriceData {
  symbol: string;
  price: string;
  change24h: string;
  changePercent24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  timestamp: number;
}

/**
 * BinanceWebSocket manages connection to Binance WebSocket streams
 * Emits 'price' events with PriceData when prices update
 */
export class BinanceWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscribedSymbols: Set<string> = new Set();
  private reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isConnected = false;

  constructor() {
    super();
  }

  /**
   * Subscribe to price updates for symbols
   */
  subscribe(symbols: string[]): void {
    const normalizedSymbols = symbols.map((s) => s.toUpperCase());
    
    for (const symbol of normalizedSymbols) {
      this.subscribedSymbols.add(symbol);
    }

    // If connected, update subscription
    if (this.ws && this.isConnected) {
      this.sendSubscription(normalizedSymbols, true);
    } else if (!this.ws && this.subscribedSymbols.size > 0) {
      // Start connection if not connected
      this.connect();
    }
  }

  /**
   * Unsubscribe from symbols
   */
  unsubscribe(symbols: string[]): void {
    const normalizedSymbols = symbols.map((s) => s.toUpperCase());
    
    for (const symbol of normalizedSymbols) {
      this.subscribedSymbols.delete(symbol);
    }

    if (this.ws && this.isConnected) {
      this.sendSubscription(normalizedSymbols, false);
    }

    // Disconnect if no subscriptions left
    if (this.subscribedSymbols.size === 0) {
      this.disconnect();
    }
  }

  /**
   * Get currently subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  /**
   * Connect to Binance WebSocket
   */
  private connect(): void {
    if (this.isShuttingDown) return;
    if (this.ws) return;

    console.log('[BinanceWS] Connecting to Binance WebSocket...');

    try {
      // Connect to combined stream endpoint
      this.ws = new WebSocket(`${BINANCE_WS_BASE}/!miniTicker@arr`);

      this.ws.on('open', () => {
        console.log('[BinanceWS] Connected to Binance WebSocket');
        this.isConnected = true;
        this.reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
        this.startPing();
        this.emit('connected');
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[BinanceWS] Connection closed: ${code} - ${reason.toString()}`);
        this.handleDisconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[BinanceWS] WebSocket error:', error.message);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('[BinanceWS] Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle incoming messages from Binance
   */
  private handleMessage(data: WebSocket.RawData): void {
    try {
      const parsed = JSON.parse(data.toString());

      // Handle array of mini tickers (from !miniTicker@arr stream)
      if (Array.isArray(parsed)) {
        for (const ticker of parsed) {
          this.processMiniTicker(ticker as BinanceMiniTicker);
        }
      } else if (parsed.e === '24hrMiniTicker') {
        // Handle single ticker
        this.processMiniTicker(parsed as BinanceMiniTicker);
      }
    } catch (error) {
      console.error('[BinanceWS] Failed to parse message:', error);
    }
  }

  /**
   * Process a mini ticker update
   */
  private processMiniTicker(ticker: BinanceMiniTicker): void {
    // Only emit for subscribed symbols
    if (!this.subscribedSymbols.has(ticker.s)) return;

    const openPrice = parseFloat(ticker.o);
    const closePrice = parseFloat(ticker.c);
    const change = closePrice - openPrice;
    const changePercent = openPrice > 0 ? (change / openPrice) * 100 : 0;

    const priceData: PriceData = {
      symbol: ticker.s,
      price: ticker.c,
      change24h: change.toFixed(8),
      changePercent24h: changePercent.toFixed(2),
      high24h: ticker.h,
      low24h: ticker.l,
      volume24h: ticker.v,
      timestamp: ticker.E,
    };

    this.emit('price', priceData);
  }

  /**
   * Send subscription message to Binance
   */
  private sendSubscription(symbols: string[], subscribe: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const streams = symbols.map((s) => `${s.toLowerCase()}@miniTicker`);
    const message = {
      method: subscribe ? 'SUBSCRIBE' : 'UNSUBSCRIBE',
      params: streams,
      id: Date.now(),
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(): void {
    this.isConnected = false;
    this.stopPing();
    this.ws = null;

    if (!this.isShuttingDown && this.subscribedSymbols.size > 0) {
      this.scheduleReconnect();
    }

    this.emit('disconnected');
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.isShuttingDown) return;

    console.log(`[BinanceWS] Reconnecting in ${this.reconnectDelay}ms...`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    // Increase delay for next attempt (exponential backoff)
    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_MULTIPLIER,
      MAX_RECONNECT_DELAY_MS
    );
  }

  /**
   * Start ping interval to keep connection alive
   */
  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stop ping interval
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Disconnect from Binance WebSocket
   */
  disconnect(): void {
    this.stopPing();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Shutdown completely (no reconnect)
   */
  shutdown(): void {
    console.log('[BinanceWS] Shutting down...');
    this.isShuttingDown = true;
    this.subscribedSymbols.clear();
    this.disconnect();
    this.removeAllListeners();
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
let instance: BinanceWebSocket | null = null;

/**
 * Get or create the BinanceWebSocket singleton
 */
export function getBinanceWebSocket(): BinanceWebSocket {
  if (!instance) {
    instance = new BinanceWebSocket();
  }
  return instance;
}

/**
 * Shutdown the BinanceWebSocket singleton
 */
export function shutdownBinanceWebSocket(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
