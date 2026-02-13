import WebSocket, { WebSocketServer } from 'ws';
import { Server } from 'http';
import { parse } from 'url';
import {
  ClientMessage,
  ServerMessage,
  PriceUpdate,
  SubscribedMessage,
  UnsubscribedMessage,
  ErrorMessage,
  ConnectedMessage,
} from './types';
import { getBinanceWebSocket, PriceData, shutdownBinanceWebSocket } from '../services/binance/binanceWebSocket';
import { mapSymbolAlias } from '../config/crypto';
import { isValidSymbol } from '../services/binance';
import { getUsWsServer } from './usWsServer';

// Max symbols per client to prevent abuse
const MAX_SYMBOLS_PER_CLIENT = 50;

// Extended WebSocket with subscription tracking
interface ExtendedWebSocket extends WebSocket {
  isAlive: boolean;
  subscribedSymbols: Set<string>;
  clientId: string;
}

/**
 * PriceWebSocketServer manages client connections and price streaming
 */
export class PriceWebSocketServer {
  private wss: WebSocketServer | null = null;
  private binanceWs = getBinanceWebSocket();
  private pingInterval: NodeJS.Timeout | null = null;
  private clientCounter = 0;

  // Track which symbols have subscribers
  private symbolSubscribers: Map<string, Set<ExtendedWebSocket>> = new Map();

  /**
   * Attach WebSocket server to HTTP server
   */
  attach(server: Server): void {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle upgrade requests
    server.on('upgrade', (request, socket, head) => {
      const { pathname } = parse(request.url || '');

      if (pathname === '/ws') {
        this.wss!.handleUpgrade(request, socket, head, (ws) => {
          this.wss!.emit('connection', ws, request);
        });
      } else if (pathname === '/ws/us') {
        getUsWsServer().handleUpgrade(request, socket, head, (ws) => {
          getUsWsServer().getWss().emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    // Handle new connections
    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws as ExtendedWebSocket);
    });

    // Setup ping interval to detect dead connections
    this.pingInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const extWs = ws as ExtendedWebSocket;
        if (!extWs.isAlive) {
          this.cleanupClient(extWs);
          return extWs.terminate();
        }
        extWs.isAlive = false;
        extWs.ping();
      });
    }, 30000);

    // Listen to Binance price updates
    this.binanceWs.on('price', (data: PriceData) => {
      this.broadcastPrice(data);
    });

    console.log('[PriceWS] WebSocket server attached to /ws');
  }

  /**
   * Handle new client connection
   */
  private handleConnection(ws: ExtendedWebSocket): void {
    ws.isAlive = true;
    ws.subscribedSymbols = new Set();
    ws.clientId = `client_${++this.clientCounter}`;

    console.log(`[PriceWS] Client connected: ${ws.clientId}`);

    // Send welcome message
    this.send(ws, {
      type: 'connected',
      message: 'Connected to Finans Takip Price Stream. Send { "type": "subscribe", "symbols": ["BTC", "ETH"] } to start.',
    });

    // Handle pong (response to our ping)
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle close
    ws.on('close', () => {
      console.log(`[PriceWS] Client disconnected: ${ws.clientId}`);
      this.cleanupClient(ws);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[PriceWS] Client error (${ws.clientId}):`, error.message);
      this.cleanupClient(ws);
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: ExtendedWebSocket, data: WebSocket.RawData): void {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, message.symbols);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(ws, message.symbols);
          break;
        case 'ping':
          this.send(ws, { type: 'pong' });
          break;
        default:
          this.sendError(ws, 'INVALID_MESSAGE', 'Unknown message type');
      }
    } catch (error) {
      this.sendError(ws, 'PARSE_ERROR', 'Invalid JSON message');
    }
  }

  /**
   * Handle subscribe request
   */
  private handleSubscribe(ws: ExtendedWebSocket, symbols: string[]): void {
    if (!Array.isArray(symbols) || symbols.length === 0) {
      return this.sendError(ws, 'INVALID_SYMBOLS', 'symbols must be a non-empty array');
    }

    // Check limit
    const newTotal = ws.subscribedSymbols.size + symbols.length;
    if (newTotal > MAX_SYMBOLS_PER_CLIENT) {
      return this.sendError(
        ws,
        'LIMIT_EXCEEDED',
        `Maximum ${MAX_SYMBOLS_PER_CLIENT} symbols per client`
      );
    }

    const subscribedSymbols: string[] = [];
    const binanceSymbols: string[] = [];

    for (const symbol of symbols) {
      // Map alias to full symbol
      const mapped = mapSymbolAlias(symbol);

      // Validate
      if (!isValidSymbol(mapped)) {
        continue; // Skip invalid symbols
      }

      // Add to client's subscriptions
      if (!ws.subscribedSymbols.has(mapped)) {
        ws.subscribedSymbols.add(mapped);
        subscribedSymbols.push(mapped);

        // Track in symbol subscribers map
        if (!this.symbolSubscribers.has(mapped)) {
          this.symbolSubscribers.set(mapped, new Set());
          binanceSymbols.push(mapped); // New symbol, need to subscribe to Binance
        }
        this.symbolSubscribers.get(mapped)!.add(ws);
      }
    }

    // Subscribe to Binance for new symbols
    if (binanceSymbols.length > 0) {
      this.binanceWs.subscribe(binanceSymbols);
    }

    // Confirm subscription
    if (subscribedSymbols.length > 0) {
      this.send(ws, {
        type: 'subscribed',
        symbols: subscribedSymbols,
      });
    }
  }

  /**
   * Handle unsubscribe request
   */
  private handleUnsubscribe(ws: ExtendedWebSocket, symbols: string[]): void {
    if (!Array.isArray(symbols)) {
      return this.sendError(ws, 'INVALID_SYMBOLS', 'symbols must be an array');
    }

    const unsubscribedSymbols: string[] = [];
    const binanceUnsubscribe: string[] = [];

    for (const symbol of symbols) {
      const mapped = mapSymbolAlias(symbol);

      if (ws.subscribedSymbols.has(mapped)) {
        ws.subscribedSymbols.delete(mapped);
        unsubscribedSymbols.push(mapped);

        // Remove from symbol subscribers
        const subscribers = this.symbolSubscribers.get(mapped);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            this.symbolSubscribers.delete(mapped);
            binanceUnsubscribe.push(mapped); // No more subscribers, unsubscribe from Binance
          }
        }
      }
    }

    // Unsubscribe from Binance if no clients need these symbols
    if (binanceUnsubscribe.length > 0) {
      this.binanceWs.unsubscribe(binanceUnsubscribe);
    }

    if (unsubscribedSymbols.length > 0) {
      this.send(ws, {
        type: 'unsubscribed',
        symbols: unsubscribedSymbols,
      });
    }
  }

  /**
   * Broadcast price update to subscribed clients
   */
  private broadcastPrice(data: PriceData): void {
    const subscribers = this.symbolSubscribers.get(data.symbol);
    if (!subscribers || subscribers.size === 0) return;

    const message: PriceUpdate = {
      type: 'price',
      symbol: data.symbol,
      price: data.price,
      change24h: data.change24h,
      changePercent24h: data.changePercent24h,
      high24h: data.high24h,
      low24h: data.low24h,
      volume24h: data.volume24h,
      timestamp: data.timestamp,
    };

    const payload = JSON.stringify(message);

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  /**
   * Cleanup client on disconnect
   */
  private cleanupClient(ws: ExtendedWebSocket): void {
    const binanceUnsubscribe: string[] = [];

    // Remove from all symbol subscriptions
    for (const symbol of ws.subscribedSymbols) {
      const subscribers = this.symbolSubscribers.get(symbol);
      if (subscribers) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.symbolSubscribers.delete(symbol);
          binanceUnsubscribe.push(symbol);
        }
      }
    }

    ws.subscribedSymbols.clear();

    // Unsubscribe from Binance if no clients need these symbols
    if (binanceUnsubscribe.length > 0) {
      this.binanceWs.unsubscribe(binanceUnsubscribe);
    }
  }

  /**
   * Send message to client
   */
  private send(ws: ExtendedWebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error to client
   */
  private sendError(ws: ExtendedWebSocket, code: string, message: string): void {
    this.send(ws, { type: 'error', code, message });
  }

  /**
   * Get server stats
   */
  getStats(): {
    clients: number;
    symbols: number;
    binanceConnected: boolean;
  } {
    return {
      clients: this.wss?.clients.size ?? 0,
      symbols: this.symbolSubscribers.size,
      binanceConnected: this.binanceWs.connected,
    };
  }

  /**
   * Shutdown the server
   */
  shutdown(): void {
    console.log('[PriceWS] Shutting down...');

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    this.wss?.clients.forEach((ws) => {
      ws.close(1001, 'Server shutting down');
    });

    this.wss?.close();
    this.symbolSubscribers.clear();
    shutdownBinanceWebSocket();
  }
}

// Singleton instance
let instance: PriceWebSocketServer | null = null;

/**
 * Get or create the PriceWebSocketServer singleton
 */
export function getPriceWebSocketServer(): PriceWebSocketServer {
  if (!instance) {
    instance = new PriceWebSocketServer();
  }
  return instance;
}

/**
 * Shutdown the PriceWebSocketServer singleton
 */
export function shutdownPriceWebSocketServer(): void {
  if (instance) {
    instance.shutdown();
    instance = null;
  }
}
