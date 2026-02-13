import { createServer } from 'http';
import app from './app';
import { config } from './config';
import { getPriceWebSocketServer, shutdownPriceWebSocketServer, getUsWsServer, shutdownUsWsServer } from './ws';

// Create HTTP server from Express app
const server = createServer(app);

// Attach WebSocket servers
const priceWs = getPriceWebSocketServer();
priceWs.attach(server);
getUsWsServer().attach(server);

// Start server
server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
  console.log(`REST API: http://localhost:${config.port}`);
  console.log(`WebSocket: ws://localhost:${config.port}/ws`);
  console.log(`WebSocket US: ws://localhost:${config.port}/ws/us`);
  console.log(`API Docs: http://localhost:${config.port}/docs`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  shutdownPriceWebSocketServer();
  shutdownUsWsServer();

  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
