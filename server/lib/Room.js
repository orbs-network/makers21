const crypto = require('crypto');
const config = require('../config');
const GameEngine = require('./GameEngine');
const NPCManager = require('./NPCManager');

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
    this.npcManager = null;

    // mediasoup
    this.router = null;
    this.directTransport = null;   // server-side transport for game state broadcasts
    this.serverProducer = null;    // server's DataProducer for game state

    // grace timer for orphan-room cleanup (set by RoomManager.createRoom)
    this.onOrphan = null;
    this.orphanTimer = null;
    this.hostGoneTimer = null;
  }

  startOrphanTimer() {
    if (this.orphanTimer) return;
    // 60s grace covers the lobby->game redirect on slow production loads
    // (heavy bundle, mediasoup negotiation, etc). If no one returns by
    // then, the room is genuinely orphaned and we delete it.
    this.orphanTimer = setTimeout(() => {
      this.orphanTimer = null;
      if (this.onOrphan) this.onOrphan(this.id);
    }, 60_000);
  }

  cancelOrphanTimer() {
    if (this.orphanTimer) {
      clearTimeout(this.orphanTimer);
      this.orphanTimer = null;
    }
  }

  startHostGoneTimer() {
    if (this.hostGoneTimer) return;
    this.hostGoneTimer = setTimeout(() => {
      this.hostGoneTimer = null;
      // Notify remaining players the host gave up, then dispose the room
      this.broadcast('roomClosed', { reason: 'Host disconnected' });
      if (this.onOrphan) this.onOrphan(this.id);
    }, 60_000);
  }

  cancelHostGoneTimer() {
    if (this.hostGoneTimer) {
      clearTimeout(this.hostGoneTimer);
      this.hostGoneTimer = null;
    }
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
      hostNick: this.hostNick,
      players: Array.from(this.players.keys()),
      playerCount: this.playerCount,
      teamACount: this.teamA.length,
      teamBCount: this.teamB.length,
      maxTeamSize: config.maxTeamSize,
    };
  }

  addPlayer(nick, ws) {
    // Reconnect during active game: same nick rejoining after page redirect/refresh
    const existing = this.players.get(nick);
    if (existing && this.isLocked) {
      // reject if someone else is already connected with this nick
      if (existing.ws && existing.ws.readyState === 1) {
        return { error: 'Nickname already in use' };
      }
      // re-attach the new WS — cancel any pending deletion timers
      existing.ws = ws;
      this.cancelOrphanTimer();
      if (nick === this.hostNick) this.cancelHostGoneTimer();
      this.lastActivity = Date.now();
      this.broadcast('roomState', this.toJSON());
      if (this.gameEngine) {
        this.sendTo(nick, 'gameState', { type: 'state', state: this.gameEngine.state });
      }
      return { ok: true };
    }

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
      dataConsumers: new Map(),
    });
    this.lastActivity = Date.now();
    this.broadcastExcept(nick, 'playerJoined', { nick });
    this.broadcast('roomState', this.toJSON());
    return { ok: true };
  }

  removePlayer(nick) {
    const player = this.players.get(nick);
    if (!player) return null;

    this.cleanupPlayerTransports(nick);

    // Active game (locked): preserve record for reconnect (handles the
    // brief WS gap during lobby->game.html redirect). If no other live
    // players remain, schedule an orphan-room deletion that gets cancelled
    // if anyone reconnects within the grace window.
    if (this.isLocked) {
      player.ws = null;
      player.sendTransport = null;
      player.recvTransport = null;
      player.dataProducer = null;
      player.dataConsumers = new Map();
      this.lastActivity = Date.now();

      // host disconnect in active game — schedule room dispose if they don't return
      if (nick === this.hostNick) {
        this.startHostGoneTimer();
      }

      // last live player gone — schedule generic orphan cleanup
      const anyOtherLive = Array.from(this.players.values())
        .some(p => p !== player && p.ws && p.ws.readyState === 1);
      if (!anyOtherLive) {
        this.startOrphanTimer();
      }

      return { shouldDelete: false };
    }

    // Waiting room — full removal
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
    return { shouldDelete: false };
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

  /**
   * Per-player "Go to Game" — any team member can call.
   * First caller prepares the game engine (idempotent). Subsequent callers
   * just receive their own gameStarting redirect.
   */
  async startGame(requesterNick) {
    const player = this.players.get(requesterNick);
    if (!player) return { error: 'Not in room' };
    if (!player.team) return { error: 'Pick a team first' };
    if (this.status === Status.FINISHED) {
      return { error: 'Game has finished — wait for reset' };
    }

    // First caller prepares the engine
    if (!this.gameEngine) {
      if (this.teamA.length === 0 || this.teamB.length === 0) {
        return { error: 'Both teams need at least one player' };
      }

      this.status = Status.STARTING;

      try {
        this.router = await this.mediasoupManager.createRouter();
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

      this.gameEngine = new GameEngine((stateMsg) => {
        this.broadcastGameState(stateMsg);
        this.broadcast('gameState', stateMsg);
        if (stateMsg.state && stateMsg.state.winnerNick) {
          this.status = Status.FINISHED;
        }
      });

      for (const nick of this.teamA) this.gameEngine.onJoin(nick, true);
      for (const nick of this.teamB) this.gameEngine.onJoin(nick, false);

      // Phase A: prepared, awaiting host commence inside game.html
      this.gameEngine.prepare(requesterNick);
      this.status = Status.PLAYING;
    }

    // Send gameStarting only to the requester — each player transitions on their own
    this.sendTo(requesterNick, 'gameStarting', {
      roomId: this.id,
      team: player.team,
      nick: requesterNick,
      rtpCapabilities: this.router.rtpCapabilities,
    });

    return { ok: true };
  }

  async startTraining(requesterNick) {
    if (requesterNick !== this.hostNick) {
      return { error: 'Only the host can start training' };
    }
    if (this.status !== Status.WAITING) {
      return { error: 'Game already started' };
    }
    if (this.players.size > 1) {
      return { error: 'Training mode is solo only' };
    }

    // find the human's team
    const human = this.players.get(requesterNick);
    if (!human || !human.team) {
      return { error: 'Pick a team first' };
    }

    this.status = Status.STARTING;

    // spawn NPCs
    this.npcManager = new NPCManager(this);
    const npcTeams = this.npcManager.spawnForTraining(human.team);

    // add NPC nicks to team rosters
    this.teamA.push(...npcTeams.teamA);
    this.teamB.push(...npcTeams.teamB);

    // create mediasoup Router
    try {
      this.router = await this.mediasoupManager.createRouter();
      this.directTransport = await this.mediasoupManager.createDirectTransport(this.router);
      this.serverProducer = await this.directTransport.produceData({
        label: 'gameState',
        protocol: 'json',
      });
    } catch (err) {
      console.error(`Room ${this.id}: failed to create mediasoup Router:`, err);
      this.npcManager.stop();
      this.npcManager = null;
      this.status = Status.WAITING;
      return { error: 'Failed to initialize game transport' };
    }

    // create game engine with NPC flag sync
    this.gameEngine = new GameEngine((stateMsg) => {
      this.broadcastGameState(stateMsg);
      this.broadcast('gameState', stateMsg);

      // sync NPC flag holding state
      if (stateMsg.state && this.npcManager) {
        this.npcManager.syncFlagState(stateMsg.state);
      }

      if (stateMsg.state && stateMsg.state.winnerNick) {
        this.status = Status.FINISHED;
      }
    });

    // register all players (human + NPCs) in game engine
    for (const nick of this.teamA) {
      this.gameEngine.onJoin(nick, true);
    }
    for (const nick of this.teamB) {
      this.gameEngine.onJoin(nick, false);
    }

    // Training mode: prepare AND commence right away — no waiting for others
    this.gameEngine.prepare(requesterNick);
    this.gameEngine.commence();

    // start NPC movement (respects countdown)
    this.npcManager.start(this.gameEngine.state.startTs);

    // notify human to redirect
    this.sendTo(requesterNick, 'gameStarting', {
      roomId: this.id,
      team: human.team,
      nick: requesterNick,
      rtpCapabilities: this.router.rtpCapabilities,
    });

    this.status = Status.PLAYING;
    return { ok: true };
  }

  /**
   * Host commences a prepared multiplayer game (Phase B).
   * Triggers the 4-second countdown for all players.
   */
  commenceGame(requesterNick) {
    if (requesterNick !== this.hostNick) {
      return { error: 'Only the host can start the game' };
    }
    if (!this.gameEngine || !this.gameEngine.state.started) {
      return { error: 'Game not prepared' };
    }
    if (this.gameEngine.state.startTs) {
      return { error: 'Game already commenced' };
    }
    const result = this.gameEngine.commence();
    if (result.error) return result;
    if (this.npcManager) {
      this.npcManager.start(this.gameEngine.state.startTs);
    }
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
      case 'playerEvent': {
        // Generic player event: forward the entire payload, override nick
        // to prevent spoofing. All fields (flag, on, pos, dir, targetNick,
        // targetTS, etc.) reach the other clients intact.
        const payload = { ...(data.payload || {}), nick };
        this.broadcastExcept(nick, 'playerEvent', payload);
        // NPC fire targeting
        if (payload.type === 'fire' && payload.targetNick && this.npcManager) {
          this.npcManager.onFireEvent(payload.targetNick);
        }
        return { ok: true };
      }
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

    if (this.npcManager) {
      this.npcManager.stop();
      this.npcManager = null;
    }

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

  /**
   * Tear down all resources. Called by RoomManager.deleteRoom.
   */
  dispose() {
    this.cancelOrphanTimer();
    this.cancelHostGoneTimer();
    // close any remaining player WS connections
    for (const [, player] of this.players) {
      this.cleanupPlayerTransports(player.nick);
      if (player.ws && player.ws.readyState === 1) {
        player.ws.close();
      }
    }

    if (this.npcManager) {
      this.npcManager.stop();
      this.npcManager = null;
    }
    if (this.gameEngine) {
      this.gameEngine.destroy();
      this.gameEngine = null;
    }
    if (this.serverProducer) { this.serverProducer.close(); this.serverProducer = null; }
    if (this.directTransport) { this.directTransport.close(); this.directTransport = null; }
    if (this.router) { this.router.close(); this.router = null; }

    this.players.clear();
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
