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

  // /api/* must NOT be cached by Fastly. The VCL caches GET responses for
  // 60s by default unless they have an explicit max-age OR a "private"
  // cache-control directive (which the VCL early-exits on). We send
  // "private, no-store, max-age=0" so Fastly bypasses cache entirely.
  // Also covers /runtime-config.js since it's environment-dependent.
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/runtime-config.js') {
      res.set('Cache-Control', 'private, no-store, max-age=0');
    }
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

  // Server caps + live counts — used by the lobby UI
  app.get('/api/info', (req, res) => {
    res.json({
      maxRooms: config.maxRooms,
      maxConcurrentPlayers: config.maxConcurrentPlayers,
      maxPlayersPerRoom: config.maxTeamSize * 2,
      currentRooms: roomManager.rooms.size,
      currentPlayers: roomManager.totalPlayers(),
    });
  });

  // Runtime config injected into pages — lets us point WS at a different
  // host (e.g. wss://ws-makers.orbs.com/ws) without rebuilding the client.
  // Set the WS_URL env var on the server to override; otherwise client uses same host.
  app.get('/runtime-config.js', (req, res) => {
    res.type('application/javascript');
    const cfg = {
      wsUrl: process.env.WS_URL || null,
    };
    res.send(`window.MAKERS21_CONFIG = ${JSON.stringify(cfg)};`);
  });

  // WebSocket signaling
  const wss = new WebSocketServer({ server, path: '/ws' });
  const signalingHandler = new SignalingHandler(roomManager, mediasoupManager);

  wss.on('connection', (ws) => {
    signalingHandler.handleConnection(ws);
  });

  server.listen(config.port, () => {
    console.log(`Makers21 server running on http://localhost:${config.port}`);
  });
}

main().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
