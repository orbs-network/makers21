import { Device } from 'mediasoup-client';

/**
 * WebRTCService - Drop-in replacement for NetworkService
 * Uses WS for signaling/game commands + mediasoup data channels for game data.
 * Falls back to WS for everything until data channels are established.
 */
class WebRTCService {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.roomId = null;
    this.nick = null;
    this.team = null;

    // mediasoup-client
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.dataProducer = null;
    this.dataConsumers = new Map(); // consumerId -> { consumer, peerId }
    this.rtcReady = false;

    // event handlers
    this._eventHandlers = new Map(); // name -> [handler, ...]
    this._wsResponseHandlers = new Map(); // requestId -> { resolve, reject }
    this._requestId = 0;
  }

  /**
   * Connect to server and join room via WS.
   * Then set up mediasoup data channels.
   */
  async init({ serverUrl, roomId, nick, team, rtpCapabilities }) {
    this.roomId = roomId;
    this.nick = nick;
    this.team = team;

    // Connect WS
    await this.connectWS(serverUrl);

    // Join room via WS
    this.wsSend('joinRoom', { roomId, nick });

    // Set up mediasoup device
    if (rtpCapabilities) {
      await this.setupMediasoup(rtpCapabilities);
    }
  }

  connectWS(serverUrl) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(serverUrl);

      this.ws.addEventListener('open', () => {
        this.connected = true;
        console.log('WebRTCService: WS connected');
        resolve();
      });

      this.ws.addEventListener('error', (err) => {
        console.error('WebRTCService: WS error', err);
        reject(err);
      });

      this.ws.addEventListener('close', () => {
        this.connected = false;
        console.log('WebRTCService: WS closed');
      });

      this.ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(ev.data);
        this.handleServerMessage(msg);
      });
    });
  }

  handleServerMessage(msg) {
    const { type, data } = msg;

    switch (type) {
      // mediasoup signaling responses
      case 'transportCreated':
      case 'transportConnected':
      case 'dataProducerCreated':
      case 'dataConsumed':
        this.handleSignalingResponse(type, data);
        break;

      // new data consumer from server (peer started producing)
      case 'newDataConsumer':
        this.handleNewDataConsumer(data);
        break;

      // game state from server (via WS fallback)
      case 'gameState':
        this.dispatchEvent('mngr', data);
        break;

      // player events via WS fallback
      case 'playerEvent':
        this.dispatchEvent('player', data);
        break;

      // room/lobby events (forwarded to subscribers)
      case 'roomState':
      case 'playerJoined':
      case 'playerLeft':
      case 'playerKicked':
      case 'gameStarting':
      case 'gameReset':
        this.dispatchEvent(type, data);
        break;

      case 'error':
        console.error('Server error:', data.message);
        this.dispatchEvent('error', data);
        break;
    }
  }

  // --- mediasoup setup ---

  async setupMediasoup(rtpCapabilities) {
    try {
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities: rtpCapabilities });

      // Create send transport
      this.sendTransport = await this.createTransport('send');
      // Create recv transport
      this.recvTransport = await this.createTransport('recv');

      // Create data producer on send transport
      this.dataProducer = await this.sendTransport.produceData({
        ordered: false,
        maxRetransmits: 0,
        label: 'gameData',
        protocol: 'json',
      });

      this.dataProducer.on('open', () => {
        console.log('WebRTCService: DataProducer open');
        this.rtcReady = true;
      });

      this.dataProducer.on('close', () => {
        console.log('WebRTCService: DataProducer closed');
        this.rtcReady = false;
      });

      // Request to consume the server's game state producer
      this.wsSend('consumeData', { producerPeerId: '__server__' });

      console.log('WebRTCService: mediasoup setup complete');
    } catch (err) {
      console.warn('WebRTCService: mediasoup setup failed, using WS fallback', err);
    }
  }

  async createTransport(direction) {
    // Request transport from server
    const response = await this.wsRequest('createTransport', { direction });

    const transportOptions = {
      id: response.id,
      iceParameters: response.iceParameters,
      iceCandidates: response.iceCandidates,
      dtlsParameters: response.dtlsParameters,
      sctpParameters: response.sctpParameters,
    };

    let transport;
    if (direction === 'send') {
      transport = this.device.createSendTransport(transportOptions);
    } else {
      transport = this.device.createRecvTransport(transportOptions);
    }

    // Handle 'connect' event — DTLS handshake
    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      this.wsRequest('connectTransport', {
        transportId: transport.id,
        dtlsParameters,
      }).then(callback).catch(errback);
    });

    // Handle 'producedata' event (send transport only)
    if (direction === 'send') {
      transport.on('producedata', (params, callback, errback) => {
        this.wsRequest('produceData', {
          transportId: transport.id,
          sctpStreamParameters: params.sctpStreamParameters,
          label: params.label,
          protocol: params.protocol,
        }).then(({ producerId }) => callback({ id: producerId })).catch(errback);
      });
    }

    return transport;
  }

  handleNewDataConsumer(data) {
    if (!this.recvTransport) return;

    this.recvTransport.consumeData({
      id: data.consumerId,
      dataProducerId: data.producerId,
      sctpStreamParameters: data.sctpStreamParameters,
      label: data.label,
      protocol: data.protocol,
    }).then(consumer => {
      this.dataConsumers.set(consumer.id, { consumer, peerId: data.peerId });

      consumer.on('message', (message) => {
        try {
          const parsed = JSON.parse(message);
          // Route based on label
          if (data.label === 'gameState' || data.peerId === '__server__') {
            this.dispatchEvent('mngr', parsed);
          } else {
            // Player data — dispatch as player event
            this.dispatchEvent('player', parsed);
          }
        } catch (e) {
          console.warn('Failed to parse data channel message', e);
        }
      });

      console.log(`WebRTCService: consuming data from ${data.peerId}`);
    }).catch(err => {
      console.error('Failed to consume data:', err);
    });
  }

  // --- WS helpers ---

  wsSend(type, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }));
    }
  }

  /**
   * Send a WS message and wait for a specific response type.
   */
  wsRequest(type, data = {}) {
    return new Promise((resolve, reject) => {
      const expectedResponse = {
        createTransport: 'transportCreated',
        connectTransport: 'transportConnected',
        produceData: 'dataProducerCreated',
        consumeData: 'dataConsumed',
      }[type];

      // Store handler for this response type
      this._pendingSignaling = this._pendingSignaling || {};
      this._pendingSignaling[expectedResponse] = { resolve, reject };

      this.wsSend(type, data);

      // Timeout
      setTimeout(() => {
        if (this._pendingSignaling[expectedResponse]) {
          delete this._pendingSignaling[expectedResponse];
          reject(new Error(`Timeout waiting for ${expectedResponse}`));
        }
      }, 10000);
    });
  }

  handleSignalingResponse(type, data) {
    if (this._pendingSignaling && this._pendingSignaling[type]) {
      const { resolve } = this._pendingSignaling[type];
      delete this._pendingSignaling[type];
      resolve(data);
    }
  }

  // --- event system ---
  //
  // Some events arrive before subscribers register (e.g. gameState arrives
  // right after WS join, but game.connect() subscribes to 'mngr' only after
  // Three.js + assets finish loading). We cache the latest value of certain
  // events and replay them to new subscribers.

  static REPLAYABLE_EVENTS = new Set(['mngr', 'roomState']);

  subscribe(name, handler) {
    if (!this._eventHandlers.has(name)) {
      this._eventHandlers.set(name, []);
    }
    this._eventHandlers.get(name).push(handler);

    // Replay cached event if present
    if (!this._cachedEvents) this._cachedEvents = new Map();
    if (this._cachedEvents.has(name)) {
      handler(this._cachedEvents.get(name));
    }
  }

  unsubscribe(name, handler) {
    const handlers = this._eventHandlers.get(name);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx > -1) handlers.splice(idx, 1);
    }
  }

  dispatchEvent(name, data) {
    // Cache replayable events for subscribers that register later
    if (WebRTCService.REPLAYABLE_EVENTS.has(name)) {
      if (!this._cachedEvents) this._cachedEvents = new Map();
      this._cachedEvents.set(name, data);
    }

    const handlers = this._eventHandlers.get(name);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  // --- game-specific methods (same interface as NetworkService) ---

  sendEvent(name, data) {
    // Map to game commands via WS
    if (data.type === 'pos') {
      this.wsSend('gameCommand', {
        command: 'playerPosition',
        pos: data.pos,
        dir: data.dir,
        moving: data.moving,
        targetTS: data.targetTS,
      });
    } else if (data.type === 'fire') {
      this.wsSend('gameCommand', {
        command: 'playerFire',
        data: data.data,
        targetNick: data.targetNick,
      });
    } else if (data.type === 'explode') {
      this.wsSend('gameCommand', {
        command: 'playerExplode',
        pos: data.pos,
        dir: data.dir,
      });
    } else if (data.type === 'lockOn') {
      this.wsSend('gameCommand', {
        command: 'playerLockOn',
        targetNick: data.targetNick,
        data: data.data,
      });
    }
  }

  broadcastPosition(positionData) {
    // Use data channel if available, otherwise WS
    if (this.rtcReady && this.dataProducer) {
      try {
        this.dataProducer.send(JSON.stringify(positionData));
        return;
      } catch (e) {
        // fall through to WS
      }
    }

    // WS fallback
    this.wsSend('gameCommand', {
      command: 'playerPosition',
      pos: positionData.pos,
      dir: positionData.dir,
      moving: positionData.moving,
      targetTS: positionData.targetTS,
    });
  }

  async checkOnline() {
    // In the new server, initial state comes via roomState after joining
    // Return a compatible response
    return new Promise((resolve) => {
      const handler = (data) => {
        if (data.type === 'state') {
          this.unsubscribe('mngr', handler);
          resolve({ status: 'ok', state: data.state });
        }
      };
      this.subscribe('mngr', handler);

      // If game is already started, the gameState events will come through
      // Give it a moment, then resolve with empty state as fallback
      setTimeout(() => {
        this.unsubscribe('mngr', handler);
        resolve({ status: 'ok', state: {} });
      }, 3000);
    });
  }

  async join(nick, isRed) {
    // In new server, join is handled by the lobby already
    // This is called by game.js but teams are pre-assigned via URL
    return 'ok';
  }

  async leave(nick, isRed) {
    this.wsSend('leaveRoom');
    return 'ok';
  }

  async start(nick) {
    this.wsSend('startGame');
    return 'ok';
  }

  async reset(nick) {
    this.wsSend('resetGame');
    return 'ok';
  }

  async gatePass(nick, isRed, winGate) {
    this.wsSend('gameCommand', { command: 'gatePass', winGate });
    return 'ok';
  }

  async flagDrop(nick, isRed) {
    this.wsSend('gameCommand', { command: 'flagDrop' });
    return 'ok';
  }

  async passFlag(nick, isRed, targetNick) {
    this.wsSend('gameCommand', { command: 'passFlag', targetNick });
    return 'ok';
  }
}

// Export singleton
const webRTCService = new WebRTCService();
window.networkService = webRTCService;

export default webRTCService;
