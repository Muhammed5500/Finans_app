import swaggerJsdoc from 'swagger-jsdoc';
import { DEFAULT_SYMBOLS, DEFAULT_INTERVAL, DEFAULT_KLINES_LIMIT } from '../config/crypto';
import { BINANCE_KLINE_INTERVALS } from '../services/binance';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Finans Takip API',
      version: '1.0.0',
      description: 'Cryptocurrency data API powered by Binance',
    },
    servers: [
      {
        url: '/',
        description: 'Current server',
      },
    ],
    tags: [
      {
        name: 'Crypto',
        description: 'Cryptocurrency market data endpoints',
      },
      {
        name: 'Health',
        description: 'Service health check',
      },
    ],
    components: {
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: true },
            result: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            ok: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INVALID_SYMBOL' },
                message: { type: 'string', example: 'Invalid symbol format' },
              },
            },
          },
        },
        PriceResult: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTCUSDT' },
            price: { type: 'string', example: '43521.50000000' },
            source: { type: 'string', example: 'binance' },
            stale: { type: 'boolean', example: false },
            fetchedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
          },
        },
        Ticker24hrResult: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTCUSDT' },
            data: {
              type: 'object',
              properties: {
                symbol: { type: 'string' },
                priceChange: { type: 'string', example: '1250.00000000' },
                priceChangePercent: { type: 'string', example: '2.95' },
                weightedAvgPrice: { type: 'string', example: '43100.50000000' },
                lastPrice: { type: 'string', example: '43521.50000000' },
                highPrice: { type: 'string', example: '44000.00000000' },
                lowPrice: { type: 'string', example: '42500.00000000' },
                volume: { type: 'string', example: '25000.50000000' },
                quoteVolume: { type: 'string', example: '1075000000.00000000' },
              },
            },
            source: { type: 'string', example: 'binance' },
            stale: { type: 'boolean' },
            fetchedAt: { type: 'string', format: 'date-time' },
          },
        },
        KlinesResult: {
          type: 'object',
          properties: {
            symbol: { type: 'string', example: 'BTCUSDT' },
            interval: { type: 'string', example: '1h' },
            limit: { type: 'integer', example: 100 },
            data: {
              type: 'array',
              items: {
                type: 'array',
                description: '[openTime, open, high, low, close, volume, closeTime, quoteVolume, trades, takerBuyBase, takerBuyQuote, ignore]',
                example: [1705312800000, '43000.00', '43500.00', '42800.00', '43200.00', '1250.5', 1705316399999, '54000000', 15000, '625.25', '27000000', '0'],
              },
            },
            source: { type: 'string', example: 'binance' },
            stale: { type: 'boolean' },
            fetchedAt: { type: 'string', format: 'date-time' },
          },
        },
        HealthResult: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            time: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Returns service health status',
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/HealthResult' },
                },
              },
            },
          },
        },
      },
      '/api/crypto/price': {
        get: {
          tags: ['Crypto'],
          summary: 'Get price for a symbol',
          description: 'Returns the current price for a trading pair. Accepts symbol aliases (e.g., BTC → BTCUSDT).',
          parameters: [
            {
              name: 'symbol',
              in: 'query',
              required: true,
              description: 'Trading pair symbol or alias (e.g., BTCUSDT, BTC, ETH)',
              schema: { type: 'string', example: 'BTC' },
            },
          ],
          responses: {
            200: {
              description: 'Price data',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        type: 'object',
                        properties: {
                          result: { $ref: '#/components/schemas/PriceResult' },
                        },
                      },
                    ],
                  },
                  example: {
                    ok: true,
                    result: {
                      symbol: 'BTCUSDT',
                      price: '43521.50000000',
                      source: 'binance',
                      fetchedAt: '2024-01-15T10:30:00.000Z',
                    },
                  },
                },
              },
            },
            400: {
              description: 'Invalid symbol',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    ok: false,
                    error: { code: 'INVALID_SYMBOL', message: 'Invalid symbol: "XYZ"' },
                  },
                },
              },
            },
            429: {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    ok: false,
                    error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again later.' },
                  },
                },
              },
            },
          },
        },
      },
      '/api/crypto/prices': {
        get: {
          tags: ['Crypto'],
          summary: 'Get prices for multiple symbols',
          description: `Returns prices for multiple trading pairs. If no symbols provided, returns default list: ${DEFAULT_SYMBOLS.join(', ')}. Accepts symbol aliases.`,
          parameters: [
            {
              name: 'symbols',
              in: 'query',
              required: false,
              description: 'Comma-separated list of symbols or aliases',
              schema: { type: 'string', example: 'BTC,ETH,SOL' },
            },
          ],
          responses: {
            200: {
              description: 'Array of price data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ok: { type: 'boolean', example: true },
                      result: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/PriceResult' },
                      },
                    },
                  },
                  example: {
                    ok: true,
                    result: [
                      { symbol: 'BTCUSDT', price: '43521.50', source: 'binance', fetchedAt: '2024-01-15T10:30:00.000Z' },
                      { symbol: 'ETHUSDT', price: '2650.25', source: 'binance', fetchedAt: '2024-01-15T10:30:00.000Z' },
                    ],
                  },
                },
              },
            },
            400: {
              description: 'Invalid symbols',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            429: {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/crypto/24hr': {
        get: {
          tags: ['Crypto'],
          summary: 'Get 24hr ticker statistics',
          description: 'Returns 24-hour price change statistics for a symbol. Accepts symbol aliases.',
          parameters: [
            {
              name: 'symbol',
              in: 'query',
              required: true,
              description: 'Trading pair symbol or alias',
              schema: { type: 'string', example: 'BTCUSDT' },
            },
          ],
          responses: {
            200: {
              description: '24hr ticker data',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        type: 'object',
                        properties: {
                          result: { $ref: '#/components/schemas/Ticker24hrResult' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: {
              description: 'Invalid symbol',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            429: {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
      '/api/crypto/klines': {
        get: {
          tags: ['Crypto'],
          summary: 'Get candlestick/kline data',
          description: `Returns candlestick chart data for a symbol. Defaults: interval=${DEFAULT_INTERVAL}, limit=${DEFAULT_KLINES_LIMIT}. Accepts symbol aliases.`,
          parameters: [
            {
              name: 'symbol',
              in: 'query',
              required: true,
              description: 'Trading pair symbol or alias',
              schema: { type: 'string', example: 'BTC' },
            },
            {
              name: 'interval',
              in: 'query',
              required: false,
              description: `Kline interval. Default: ${DEFAULT_INTERVAL}`,
              schema: {
                type: 'string',
                enum: BINANCE_KLINE_INTERVALS as unknown as string[],
                default: DEFAULT_INTERVAL,
              },
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: `Number of klines to return (1-1000). Default: ${DEFAULT_KLINES_LIMIT}`,
              schema: {
                type: 'integer',
                minimum: 1,
                maximum: 1000,
                default: DEFAULT_KLINES_LIMIT,
              },
            },
          ],
          responses: {
            200: {
              description: 'Kline data',
              content: {
                'application/json': {
                  schema: {
                    allOf: [
                      { $ref: '#/components/schemas/SuccessResponse' },
                      {
                        type: 'object',
                        properties: {
                          result: { $ref: '#/components/schemas/KlinesResult' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            400: {
              description: 'Invalid parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
            429: {
              description: 'Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                },
              },
            },
          },
        },
      },
    },
  },
  apis: [], // We define everything inline above
};

export const swaggerSpec = swaggerJsdoc(options);
