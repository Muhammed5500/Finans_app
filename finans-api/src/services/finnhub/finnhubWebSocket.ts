/**
 * Finnhub WebSocket client for real-time trades.
 * One connection per API key; reconnect with exponential backoff; re-subscribe on reconnect.
 * @see https://finnhub.io/docs/api/websocket-trades
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

const WSS_URL = 'wss://ws.finnhub.io';

const INITIAL_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 60000;
const RECONNECT_MULTIPLIER = 2;

export interface FinnhubTrade {
  s: string;   // symbol
  p: number;  // price
  t: number;  // timestamp (Unix ms)
  v: number;  // volume
  c?: string[]; // conditions
}

export interface FinnhubTradeMessage {
  type: 'trade';
  data: FinnhubTrade[];
}

export class FinnhubWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscribed = new Set<string>();
  private delay = INITIAL_RECONNECT_MS;
  private timer: NodeJS.Timeout | null = null;
  private shutdown = false;
  private token: string;

  constructor() {
    super();
    this.token = process.env.FINNHUB_API_KEY || process.env.FINNHUB_TOKEN || '';
  }

  subscribe(symbols: string[]): void {
    const added: string[] = [];
    for (const s of symbols) {
      const sym = String(s).toUpperCase().trim();
      if (!sym || added.includes(sym)) continue;
      if (this.subscribed.has(sym)) continue;
      this.subscribed.add(sym);
      added.push(sym);
    }
    if (added.length === 0) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      for (const s of added) {
        try { this.ws.send(JSON.stringify({ type: 'subscribe', symbol: s })); } catch (_) {}
      }
    } else if (this.subscribed.size > 0) {
      this.connect();
    }
  }

  unsubscribe(symbols: string[]): void {
    const removed: string[] = [];
    for (const s of symbols) {
      const sym = String(s).toUpperCase().trim();
      if (!this.subscribed.has(sym)) continue;
      this.subscribed.delete(sym);
      removed.push(sym);
    }
    if (removed.length === 0) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      for (const s of removed) {
        try { this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol: s })); } catch (_) {}
      }
    }
    if (this.subscribed.size === 0) {
      this.disconnect();
    }
  }

  private connect(): void {
    if (this.shutdown || this.ws) return;
    if (!this.token) {
      console.warn('[FinnhubWS] No FINNHUB_API_KEY or FINNHUB_TOKEN; skipping connect');
      this.schedule();
      return;
    }
    const url = `${WSS_URL}?token=${encodeURIComponent(this.token)}`;
    try {
      this.ws = new WebSocket(url);
    } catch (e) {
      this.schedule();
      return;
    }

    this.ws.on('open', () => {
      this.delay = INITIAL_RECONNECT_MS;
      const syms = Array.from(this.subscribed);
      for (const s of syms) {
        try { this.ws!.send(JSON.stringify({ type: 'subscribe', symbol: s })); } catch (_) {}
      }
      this.emit('connected');
    });

    this.ws.on('message', (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type?: string; data?: FinnhubTrade[] };
        if (msg.type === 'trade' && Array.isArray(msg.data)) {
          this.emit('trade', msg as FinnhubTradeMessage);
        }
      } catch (_) {}
    });

    this.ws.on('close', () => {
      this.ws = null;
      this.emit('disconnected');
      if (!this.shutdown && this.subscribed.size > 0) this.schedule();
    });

    this.ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.connect();
    }, this.delay);
    this.delay = Math.min(this.delay * RECONNECT_MULTIPLIER, MAX_RECONNECT_MS);
  }

  disconnect(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
  }

  close(): void {
    this.shutdown = true;
    this.subscribed.clear();
    this.disconnect();
    this.removeAllListeners();
  }
}

let inst: FinnhubWebSocket | null = null;

export function getFinnhubWebSocket(): FinnhubWebSocket {
  if (!inst) inst = new FinnhubWebSocket();
  return inst;
}

export function shutdownFinnhubWebSocket(): void {
  if (inst) {
    inst.close();
    inst = null;
  }
}
