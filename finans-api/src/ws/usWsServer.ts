/**
 * WebSocket server for /ws/us — Finnhub US trade streaming.
 * Clients: { type:"subscribe", symbols:["AAPL","MSFT"] }.
 * Forwards relevant ticks; reconnect + backoff in finnhubWebSocket.
 */

import WebSocket, { WebSocketServer } from 'ws';
import { parse } from 'url';
import { getFinnhubWebSocket, shutdownFinnhubWebSocket, type FinnhubTradeMessage } from '../services/finnhub/finnhubWebSocket';
import { normalizeUsSymbol } from '../utils/usSymbols';

const MAX_SYMBOLS_PER_CLIENT = 50;
const MAX_TOTAL_SYMBOLS = 200;

interface ExtWs extends WebSocket {
  isAlive?: boolean;
  subscribedSymbols?: Set<string>;
  clientId?: string;
}

export class UsWsServer {
  private wss: WebSocketServer | null = null;
  private fh = getFinnhubWebSocket();
  private symbolSubscribers = new Map<string, Set<ExtWs>>();
  private clientCounter = 0;
  private pingInterval: NodeJS.Timeout | null = null;

  getWss(): WebSocketServer { return this.wss!; }

  attach(_server: unknown): void {
    this.wss = new WebSocketServer({ noServer: true });

    this.wss.on('connection', (ws: WebSocket) => {
      this.onConnection(ws as ExtWs);
    });

    this.pingInterval = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        const e = ws as ExtWs;
        if (!e.isAlive) { this.cleanup(e); (ws as WebSocket).terminate(); return; }
        e.isAlive = false;
        (ws as WebSocket).ping();
      });
    }, 30000);

    this.fh.on('trade', (msg: FinnhubTradeMessage) => this.forward(msg));
  }

  handleUpgrade(
    req: import('http').IncomingMessage,
    socket: import('stream').Duplex,
    head: Buffer,
    cb: (ws: WebSocket, req: import('http').IncomingMessage) => void
  ): void {
    if (!this.wss) return;
    this.wss.handleUpgrade(req, socket, head, (ws) => cb(ws, req));
  }

  private onConnection(ws: ExtWs): void {
    ws.isAlive = true;
    ws.subscribedSymbols = new Set();
    ws.clientId = `us_${++this.clientCounter}`;

    this.send(ws, { type: 'connected', message: 'US trade stream. Send { "type":"subscribe", "symbols":["AAPL","MSFT"] }.' });

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (data: WebSocket.RawData) => { this.onMessage(ws, data); });
    ws.on('close', () => { this.cleanup(ws); });
    ws.on('error', () => { this.cleanup(ws); });
  }

  private onMessage(ws: ExtWs, raw: WebSocket.RawData): void {
    try {
      const msg = JSON.parse(raw.toString()) as { type?: string; symbols?: string[] };
      if (msg.type === 'subscribe') {
        this.doSubscribe(ws, Array.isArray(msg.symbols) ? msg.symbols : []);
      } else if (msg.type === 'unsubscribe') {
        this.doUnsubscribe(ws, Array.isArray(msg.symbols) ? msg.symbols : []);
      } else if (msg.type === 'ping') {
        this.send(ws, { type: 'pong' });
      } else {
        this.send(ws, { type: 'error', code: 'INVALID_MESSAGE', message: 'Unknown type' });
      }
    } catch {
      this.send(ws, { type: 'error', code: 'PARSE_ERROR', message: 'Invalid JSON' });
    }
  }

  private doSubscribe(ws: ExtWs, symbols: string[]): void {
    if (symbols.length === 0) {
      this.send(ws, { type: 'error', code: 'INVALID_SYMBOLS', message: 'symbols must be non-empty' });
      return;
    }
    const total = (ws.subscribedSymbols?.size ?? 0) + symbols.length;
    if (total > MAX_SYMBOLS_PER_CLIENT) {
      this.send(ws, { type: 'error', code: 'LIMIT_EXCEEDED', message: `Max ${MAX_SYMBOLS_PER_CLIENT} symbols per client` });
      return;
    }
    const added: string[] = [];
    for (const s of symbols) {
      try {
        const sym = normalizeUsSymbol(s);
        if (ws.subscribedSymbols!.has(sym)) continue;
        if (this.symbolSubscribers.size >= MAX_TOTAL_SYMBOLS && !this.symbolSubscribers.has(sym)) {
          this.send(ws, { type: 'error', code: 'LIMIT_EXCEEDED', message: 'Server symbol limit reached' });
          return;
        }
        ws.subscribedSymbols!.add(sym);
        added.push(sym);
        let set = this.symbolSubscribers.get(sym);
        if (!set) {
          set = new Set();
          this.symbolSubscribers.set(sym, set);
          this.fh.subscribe([sym]);
        }
        set.add(ws);
      } catch {
        // normalizeUsSymbol throws BAD_REQUEST
        this.send(ws, { type: 'error', code: 'BAD_REQUEST', message: 'Invalid US symbol format' });
        return;
      }
    }
    if (added.length) this.send(ws, { type: 'subscribed', symbols: added });
  }

  private doUnsubscribe(ws: ExtWs, symbols: string[]): void {
    const removed: string[] = [];
    for (const s of symbols) {
      const sym = String(s).toUpperCase().trim();
      if (!ws.subscribedSymbols?.has(sym)) continue;
      ws.subscribedSymbols.delete(sym);
      removed.push(sym);
      const set = this.symbolSubscribers.get(sym);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.symbolSubscribers.delete(sym);
          this.fh.unsubscribe([sym]);
        }
      }
    }
    if (removed.length) this.send(ws, { type: 'unsubscribed', symbols: removed });
  }

  private forward(msg: FinnhubTradeMessage): void {
    if (!Array.isArray(msg.data)) return;
    for (const d of msg.data) {
      const sym = d?.s;
      if (!sym) continue;
      const set = this.symbolSubscribers.get(sym);
      if (!set?.size) continue;
      const payload = JSON.stringify({
        type: 'trade',
        symbol: sym,
        price: d.p,
        volume: d.v ?? 0,
        time: new Date(d.t).toISOString(),
        conditions: d.c,
      });
      for (const w of set) {
        if (w.readyState === WebSocket.OPEN) w.send(payload);
      }
    }
  }

  private cleanup(ws: ExtWs): void {
    const unsub: string[] = [];
    for (const s of ws.subscribedSymbols ?? []) {
      unsub.push(s);
      const set = this.symbolSubscribers.get(s);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          this.symbolSubscribers.delete(s);
          this.fh.unsubscribe([s]);
        }
      }
    }
    ws.subscribedSymbols?.clear();
  }

  private send(ws: ExtWs, msg: object): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  shutdown(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.wss?.clients.forEach((c) => (c as WebSocket).close(1001, 'Server shutdown'));
    this.wss?.close();
    this.symbolSubscribers.clear();
  }
}

let us: UsWsServer | null = null;

export function getUsWsServer(): UsWsServer {
  if (!us) us = new UsWsServer();
  return us;
}

export function shutdownUsWsServer(): void {
  if (us) {
    us.shutdown();
    us = null;
  }
  shutdownFinnhubWebSocket();
}
