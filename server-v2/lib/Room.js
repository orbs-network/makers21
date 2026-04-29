const crypto = require('crypto');
const config = require('../config');
const GameEngine = require('./GameEngine');

const Status = {
  WAITING: 'waiting',
  STARTING: 'starting',
  PLAYING: 'playing',
  FINISHED: 'finished',
};

class Room {
  constructor(name, hostNick, mediasoupManager) {
    this.id = crypto.randomBytes(3).toString('hex');
    this.name = name;
    this.hostNick = hostNick;
    this.mediasoupManager = mediasoupManager;
    this.status = Status.WAITING;
    this.teamA = [];          // array of nicks
    this.teamB = [];          // array of nicks
    this.players = new Map(); // nick -> { ws, team, sendTransport, recvTransport, dataProducer, dataConsumers }
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.gameEngine = null;

    // mediasoup
    this.router = null;
    this.directTransport = null;   // server-side transport for game state broadcasts
    this.serverProducer = null;    // server's DataProducer for game state
  }

  get playerCount() {
    return this.players.size;
  }

  get isLocked() {
    return this.status !== Status.WAITING;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      hostNick: this.hostNick,
      status: this.status,
      teamA: this.teamA,
      teamB: this.teamB,
      playerCount: this.playerCount,
      maxTeamSize: config.maxTeamSize,
      rtpCapabilities: this.router ? this.router.rtpCapabilities : null,
    };
  }

  toListJSON() {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      playerCount: this.playerCount,
      teamACount: this.teamA.length,
      teamBCount: this.teamB.length,
      maxTeamSize: config.maxTeamSize,
    };
  }

  addPlayer(nick, ws) {
    if (this.isLocked) {
      return { error: 'Room is locked — game in progress' };
    }
    if (this.players.has(nick)) {
      return { error: 'Nickname already taken in this room' };
    }
    if (this.playerCount >= config.maxTeamSize * 2) {
      return { error: 'Room is full' };
    }

    this.players.set(nick, {
      ws,
      team: null,
      sendTransport: null,
      recvTransport: null,
      dataProducer: null,
      dataConsumers: new Map(), // producerId -> DataConsumer
    });
    this.lastActivity = Date.now();
    this.broadcastExcept(nick, 'playerJoined', { nick });
    this.broadcast('roomState', this.toJSON());
    return { ok: true };
  }

  removePlayer(nick) {
    const player = this.players.get(nick);
    if (!player) return;

    // cleanup mediasoup transports
    this.cleanupPlayerTransports(nick);

    if (player.team === 'A') {
      this.teamA = this.teamA.filter(n => n !== nick);
    } else if (player.team === 'B') {
      this.teamB = this.teamB.filter(n => n !== nick);
    }

    this.players.delete(nick);
    this.lastActivity = Date.now();

    // transfer host if host left
    if (nick === this.hostNick && this.players.size > 0) {
      this.hostNick = this.players.keys().next().value;
      this.broadcast('roomState', this.toJSON());
    }

    this.broadcast('playerLeft', { nick });
    return this.players.size === 0;
  }

  pickTeam(nick, team) {
    if (this.isLocked) {
      return { error: 'Cannot switch teams — game in progress' };
    }
    if (team !== 'A' && team !== 'B') {
      return { error: 'Invalid team' };
    }
    const player = this.players.get(nick);
    if (!player) {
      return { error: 'Player not in room' };
    }

    const targetTeam = team === 'A' ? this.teamA : this.teamB;
    if (targetTeam.length >= config.maxTeamSize) {
      return { error: 'Team is full' };
    }

    if (player.team === 'A') {
      this.teamA = this.teamA.filter(n => n !== nick);
    } else if (player.team === 'B') {
      this.teamB = this.teamB.filter(n => n !== nick);
    }

    if (team === 'A') {
      this.teamA.push(nick);
    } else {
      this.teamB.push(nick);
    }
    player.team = team;

    this.broadcast('roomState', this.toJSON());
    return { ok: true };
  }

  kickPlayer(requesterNick, targetNick) {
    if (requesterNick !== this.hostNick) {
      return { error: 'Only the host can kick players' };
    }
    if (targetNick === this.hostNick) {
      return { error: 'Cannot kick yourself' };
    }
    const target = this.players.get(targetNick);
    if (!target) {
      return { error: 'Player not in room' };
    }

    this.sendTo(targetNick, 'playerKicked', { nick: targetNick, reason: 'Kicked by host' });

    if (target.ws && target.ws.readyState === 1) {
      target.ws.close();
    }

    this.removePlayer(targetNick);
    return { ok: true };
  }

  async startGame(requesterNick) {
    if (requesterNick !== this.hostNick) {
      return { error: 'Only the host can start the game' };
    }
    if (this.status !== Status.WAITING) {
      return { error: 'Game already started' };
    }
    if (this.teamA.length === 0 || this.teamB.length === 0) {
      return { error: 'Both teams need at least one player' };
    }

    this.status = Status.STARTING;

    // kick spectators
    for (const [nick, player] of this.players) {
      if (!player.team) {
        this.sendTo(nick, 'playerKicked', { nick, reason: 'Game started — no team selected' });
        if (player.ws && player.ws.readyState === 1) {
          player.ws.close();
        }
        this.players.delete(nick);
      }
    }

    // create mediasoup Router for this room
    try {
      this.router = await this.mediasoupManager.createRouter();

      // create DirectTransport for server → client game state broadcasts
      this.directTransport = await this.mediasoupManager.createDirectTransport(this.router);
      this.serverProducer = await this.directTransport.produceData({
        label: 'gameState',
        protocol: 'json',
      });

      console.log(`Room ${this.id}: mediasoup Router + DirectTransport created`);
    } catch (err) {
      console.error(`Room ${this.id}: failed to create mediasoup Router:`, err);
      this.status = Status.WAITING;
      return { error: 'Failed to initialize game transport' };
    }

    // create game engine
    this.gameEngine = new GameEngine((stateMsg) => {
      // broadcast game state via DirectTransport data channel
      this.broadcastGameState(stateMsg);
      // also send via WS as fallback (for clients not yet on WebRTC)
      this.broadcast('gameState', stateMsg);

      if (stateMsg.state && stateMsg.state.winnerNick) {
        this.status = Status.FINISHED;
      }
    });

    for (const nick of this.teamA) {
      this.gameEngine.onJoin(nick, true);
    }
    for (const nick of this.teamB) {
      this.gameEngine.onJoin(nick, false);
    }

    this.gameEngine.onStart(requesterNick);

    // notify all to redirect — include rtpCapabilities so clients can set up WebRTC
    for (const [nick, player] of this.players) {
      this.sendTo(nick, 'gameStarting', {
        roomId: this.id,
        team: player.team,
        nick,
        rtpCapabilities: this.router.rtpCapabilities,
      });
    }

    this.status = Status.PLAYING;
    return { ok: true };
  }

  // --- mediasoup transport management ---

  async createTransport(nick, direction) {
    if (!this.router) {
      return { error: 'No active game router' };
    }
    const player = this.players.get(nick);
    if (!player) {
      return { error: 'Player not in room' };
    }

    const { transport, params } = await this.mediasoupManager.createWebRtcTransport(this.router);

    if (direction === 'send') {
      // close old one if exists
      if (player.sendTransport) player.sendTransport.close();
      player.sendTransport = transport;
    } else {
      if (player.recvTransport) player.recvTransport.close();
      player.recvTransport = transport;
    }

    return { ok: true, params };
  }

  async connectTransport(nick, transportId, dtlsParameters) {
    const player = this.players.get(nick);
    if (!player) return { error: 'Player not in room' };

    const transport = this.findTransport(player, transportId);
    if (!transport) return { error: 'Transport not found' };

    await transport.connect({ dtlsParameters });
    return { ok: true };
  }

  async produceData(nick, transportId, sctpStreamParameters, label, protocol) {
    const player = this.players.get(nick);
    if (!player) return { error: 'Player not in room' };

    const transport = this.findTransport(player, transportId);
    if (!transport) return { error: 'Transport not found' };

    const dataProducer = await transport.produceData({
      sctpStreamParameters,
      label: label || 'gameData',
      protocol: protocol || 'json',
    });

    player.dataProducer = dataProducer;

    // when this producer has data, relay to game engine for activity tracking
    // and broadcast to other players via their consumers
    console.log(`Room ${this.id}: DataProducer created for ${nick} [${dataProducer.id}]`);

    // notify all other players to consume this new producer
    for (const [otherNick, otherPlayer] of this.players) {
      if (otherNick !== nick && otherPlayer.recvTransport) {
        this.createConsumerForPeer(otherNick, nick, dataProducer.id).catch(err => {
          console.error(`Failed to create consumer for ${otherNick}:`, err);
        });
      }
    }

    return { ok: true, producerId: dataProducer.id };
  }

  async consumeData(nick, producerPeerId) {
    const player = this.players.get(nick);
    if (!player) return { error: 'Player not in room' };
    if (!player.recvTransport) return { error: 'No recv transport' };

    // find the producer
    let dataProducerId;
    if (producerPeerId === '__server__') {
      // consume server's game state producer
      dataProducerId = this.serverProducer?.id;
    } else {
      const producerPlayer = this.players.get(producerPeerId);
      dataProducerId = producerPlayer?.dataProducer?.id;
    }

    if (!dataProducerId) return { error: 'Producer not found' };

    return this.createConsumerForPeer(nick, producerPeerId, dataProducerId);
  }

  async createConsumerForPeer(consumerNick, producerPeerId, dataProducerId) {
    const consumer = this.players.get(consumerNick);
    if (!consumer || !consumer.recvTransport) {
      return { error: 'Consumer has no recv transport' };
    }

    const dataConsumer = await consumer.recvTransport.consumeData({
      dataProducerId,
    });

    consumer.dataConsumers.set(dataProducerId, dataConsumer);

    // notify the consumer client about the new data consumer
    this.sendTo(consumerNick, 'newDataConsumer', {
      consumerId: dataConsumer.id,
      producerId: dataProducerId,
      peerId: producerPeerId,
      sctpStreamParameters: dataConsumer.sctpStreamParameters,
      label: dataConsumer.label,
      protocol: dataConsumer.protocol,
    });

    return {
      ok: true,
      consumerId: dataConsumer.id,
      sctpStreamParameters: dataConsumer.sctpStreamParameters,
      label: dataConsumer.label,
      protocol: dataConsumer.protocol,
    };
  }

  broadcastGameState(stateMsg) {
    if (this.serverProducer) {
      try {
        this.serverProducer.send(Buffer.from(JSON.stringify(stateMsg)));
      } catch (err) {
        // fallback is WS broadcast which is already handled
      }
    }
  }

  cleanupPlayerTransports(nick) {
    const player = this.players.get(nick);
    if (!player) return;

    if (player.dataProducer) player.dataProducer.close();
    for (const [, consumer] of player.dataConsumers) {
      consumer.close();
    }
    if (player.sendTransport) player.sendTransport.close();
    if (player.recvTransport) player.recvTransport.close();
  }

  findTransport(player, transportId) {
    if (player.sendTransport?.id === transportId) return player.sendTransport;
    if (player.recvTransport?.id === transportId) return player.recvTransport;
    return null;
  }

  // --- game commands (forwarded to GameEngine) ---

  gameCommand(nick, command, data) {
    if (!this.gameEngine) {
      return { error: 'No active game' };
    }

    const isRed = this.teamA.includes(nick);

    switch (command) {
      case 'gatePass':
        return this.gameEngine.onGatePass(nick, isRed, data.winGate);
      case 'flagDrop':
        return this.gameEngine.onFlagDrop(nick, isRed);
      case 'passFlag':
        return this.gameEngine.onPassFlag(nick, isRed, data.targetNick);
      case 'playerPosition':
        this.gameEngine.trackActivity(nick);
        this.broadcastExcept(nick, 'playerEvent', {
          type: 'pos',
          nick,
          pos: data.pos,
          dir: data.dir,
          moving: data.moving,
          targetTS: data.targetTS,
        });
        return { ok: true };
      case 'playerFire':
        this.broadcastExcept(nick, 'playerEvent', {
          type: 'fire',
          nick,
          data: data.data,
          targetNick: data.targetNick,
        });
        return { ok: true };
      case 'playerExplode':
        this.broadcastExcept(nick, 'playerEvent', {
          type: 'explode',
          nick,
          pos: data.pos,
          dir: data.dir,
        });
        return { ok: true };
      case 'playerLockOn':
        this.broadcastExcept(nick, 'playerEvent', {
          type: 'lockOn',
          nick,
          targetNick: data.targetNick,
          data: data.data,
        });
        return { ok: true };
      default:
        return { error: `Unknown game command: ${command}` };
    }
  }

  async resetGame(requesterNick) {
    if (requesterNick !== this.hostNick) {
      return { error: 'Only the host can reset' };
    }

    // cleanup mediasoup
    if (this.serverProducer) { this.serverProducer.close(); this.serverProducer = null; }
    if (this.directTransport) { this.directTransport.close(); this.directTransport = null; }
    for (const [nick] of this.players) {
      this.cleanupPlayerTransports(nick);
    }
    if (this.router) { this.router.close(); this.router = null; }

    if (this.gameEngine) {
      this.gameEngine.destroy();
      this.gameEngine = null;
    }

    this.status = Status.WAITING;
    this.teamA = [];
    this.teamB = [];
    for (const [, player] of this.players) {
      player.team = null;
      player.sendTransport = null;
      player.recvTransport = null;
      player.dataProducer = null;
      player.dataConsumers = new Map();
    }

    this.broadcast('gameReset', {});
    this.broadcast('roomState', this.toJSON());
    return { ok: true };
  }

  // --- messaging (WS) ---

  broadcast(type, data) {
    const msg = JSON.stringify({ type, data });
    for (const [, player] of this.players) {
      if (player.ws && player.ws.readyState === 1) {
        player.ws.send(msg);
      }
    }
  }

  broadcastExcept(excludeNick, type, data) {
    const msg = JSON.stringify({ type, data });
    for (const [nick, player] of this.players) {
      if (nick !== excludeNick && player.ws && player.ws.readyState === 1) {
        player.ws.send(msg);
      }
    }
  }

  sendTo(nick, type, data) {
    const player = this.players.get(nick);
    if (player && player.ws && player.ws.readyState === 1) {
      player.ws.send(JSON.stringify({ type, data }));
    }
  }
}

Room.Status = Status;
module.exports = Room;
