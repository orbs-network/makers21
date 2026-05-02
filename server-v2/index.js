const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const config = require('./config');
const RoomManager = require('./lib/RoomManager');
const SignalingHandler = require('./lib/SignalingHandler');
const MediasoupManager = require('./lib/MediasoupManager');
const createRoomRoutes = require('./routes/rooms');

async function main() {
  // Init mediasoup workers
  const mediasoupManager = new MediasoupManager();
  await mediasoupManager.init();

  const app = express();
  const server = http.createServer(app);

  // middleware
  app.use(express.json());

  // disable caching during development so updates show without hard reload
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    next();
  });

  // static lobby files (index.html = lobby)
  app.use(express.static(path.join(__dirname, 'public')));

  // serve built game files (game.html + assets from webpack dist/)
  app.use(express.static(path.join(__dirname, '..', 'dist')));

  // serve raw source assets (for lobby video, etc. — no build step needed)
  app.use('/assets', express.static(path.join(__dirname, '..', 'src', 'assets')));

  // REST API
  const roomManager = new RoomManager(mediasoupManager);
  app.use('/api/rooms', createRoomRoutes(roomManager));

  // WebSocket signaling
  const wss = new WebSocketServer({ server, path: '/ws' });
  const signalingHandler = new SignalingHandler(roomManager, mediasoupManager);

  wss.on('connection', (ws) => {
    signalingHandler.handleConnection(ws);
  });

  server.listen(config.port, () => {
    console.log(`Makers21 server-v2 running on http://localhost:${config.port}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
