/**
 * WebSocket message types for client-server communication
 */

// --- Client -> Server Messages ---

export interface SubscribeMessage {
  type: 'subscribe';
  symbols: string[];
}

export interface UnsubscribeMessage {
  type: 'unsubscribe';
  symbols: string[];
}

export interface PingMessage {
  type: 'ping';
}

export type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

// --- Server -> Client Messages ---

export interface PriceUpdate {
  type: 'price';
  symbol: string;
  price: string;
  change24h: string;
  changePercent24h: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  timestamp: number;
}

export interface SubscribedMessage {
  type: 'subscribed';
  symbols: string[];
}

export interface UnsubscribedMessage {
  type: 'unsubscribed';
  symbols: string[];
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface PongMessage {
  type: 'pong';
}

export interface ConnectedMessage {
  type: 'connected';
  message: string;
}

export type ServerMessage =
  | PriceUpdate
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | PongMessage
  | ConnectedMessage;

// --- Binance WebSocket types ---

export interface BinanceMiniTicker {
  e: '24hrMiniTicker';  // Event type
  E: number;            // Event time
  s: string;            // Symbol
  c: string;            // Close price
  o: string;            // Open price
  h: string;            // High price
  l: string;            // Low price
  v: string;            // Total traded base asset volume
  q: string;            // Total traded quote asset volume
}
