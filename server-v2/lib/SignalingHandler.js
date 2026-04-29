class SignalingHandler {
  constructor(roomManager, mediasoupManager) {
    this.roomManager = roomManager;
    this.mediasoupManager = mediasoupManager;
  }

  handleConnection(ws) {
    ws.playerNick = null;
    ws.roomId = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return this.send(ws, 'error', { message: 'Invalid JSON' });
      }
      this.handleMessage(ws, msg);
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  handleMessage(ws, msg) {
    const { type, data = {} } = msg;

    switch (type) {
      // lobby
      case 'joinRoom':
        return this.onJoinRoom(ws, data);
      case 'leaveRoom':
        return this.onLeaveRoom(ws);
      case 'pickTeam':
        return this.onPickTeam(ws, data);
      case 'kickPlayer':
        return this.onKickPlayer(ws, data);
      case 'startGame':
        return this.onStartGame(ws);
      case 'resetGame':
        return this.onResetGame(ws);
      case 'gameCommand':
        return this.onGameCommand(ws, data);

      // mediasoup signaling
      case 'createTransport':
        return this.onCreateTransport(ws, data);
      case 'connectTransport':
        return this.onConnectTransport(ws, data);
      case 'produceData':
        return this.onProduceData(ws, data);
      case 'consumeData':
        return this.onConsumeData(ws, data);

      default:
        return this.send(ws, 'error', { message: `Unknown message type: ${type}` });
    }
  }

  // --- lobby handlers ---

  onJoinRoom(ws, { roomId, nick }) {
    if (!roomId || !nick) {
      return this.send(ws, 'error', { message: 'roomId and nick are required' });
    }

    if (ws.roomId) {
      this.onLeaveRoom(ws);
    }

    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      return this.send(ws, 'error', { message: 'Room not found' });
    }

    const result = room.addPlayer(nick, ws);
    if (result.error) {
      return this.send(ws, 'error', { message: result.error });
    }

    ws.playerNick = nick;
    ws.roomId = roomId;
  }

  onLeaveRoom(ws) {
    if (!ws.roomId) return;

    const room = this.roomManager.getRoom(ws.roomId);
    if (room) {
      room.removePlayer(ws.playerNick);
    }

    ws.playerNick = null;
    ws.roomId = null;
  }

  onPickTeam(ws, { team }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    const result = room.pickTeam(ws.playerNick, team);
    if (result.error) {
      return this.send(ws, 'error', { message: result.error });
    }
  }

  onKickPlayer(ws, { targetNick }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    const result = room.kickPlayer(ws.playerNick, targetNick);
    if (result.error) {
      return this.send(ws, 'error', { message: result.error });
    }
  }

  async onStartGame(ws) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    const result = await room.startGame(ws.playerNick);
    if (result.error) {
      return this.send(ws, 'error', { message: result.error });
    }
  }

  async onResetGame(ws) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    const result = await room.resetGame(ws.playerNick);
    if (result.error) {
      return this.send(ws, 'error', { message: result.error });
    }
  }

  onGameCommand(ws, { command, ...rest }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    const result = room.gameCommand(ws.playerNick, command, rest);
    if (result && result.error) {
      return this.send(ws, 'error', { message: result.error });
    }
  }

  // --- mediasoup signaling handlers ---

  async onCreateTransport(ws, { direction }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    if (direction !== 'send' && direction !== 'recv') {
      return this.send(ws, 'error', { message: 'direction must be "send" or "recv"' });
    }

    try {
      const result = await room.createTransport(ws.playerNick, direction);
      if (result.error) {
        return this.send(ws, 'error', { message: result.error });
      }
      this.send(ws, 'transportCreated', { direction, ...result.params });
    } catch (err) {
      this.send(ws, 'error', { message: 'Failed to create transport' });
    }
  }

  async onConnectTransport(ws, { transportId, dtlsParameters }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    try {
      const result = await room.connectTransport(ws.playerNick, transportId, dtlsParameters);
      if (result.error) {
        return this.send(ws, 'error', { message: result.error });
      }
      this.send(ws, 'transportConnected', { transportId });
    } catch (err) {
      this.send(ws, 'error', { message: 'Failed to connect transport' });
    }
  }

  async onProduceData(ws, { transportId, sctpStreamParameters, label, protocol }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    try {
      const result = await room.produceData(
        ws.playerNick, transportId, sctpStreamParameters, label, protocol
      );
      if (result.error) {
        return this.send(ws, 'error', { message: result.error });
      }
      this.send(ws, 'dataProducerCreated', { producerId: result.producerId });
    } catch (err) {
      this.send(ws, 'error', { message: 'Failed to produce data' });
    }
  }

  async onConsumeData(ws, { producerPeerId }) {
    const room = this.getPlayerRoom(ws);
    if (!room) return;

    try {
      const result = await room.consumeData(ws.playerNick, producerPeerId);
      if (result.error) {
        return this.send(ws, 'error', { message: result.error });
      }
      this.send(ws, 'dataConsumed', {
        consumerId: result.consumerId,
        sctpStreamParameters: result.sctpStreamParameters,
        label: result.label,
        protocol: result.protocol,
      });
    } catch (err) {
      this.send(ws, 'error', { message: 'Failed to consume data' });
    }
  }

  // --- common ---

  handleDisconnect(ws) {
    this.onLeaveRoom(ws);
  }

  getPlayerRoom(ws) {
    if (!ws.roomId) {
      this.send(ws, 'error', { message: 'Not in a room' });
      return null;
    }
    const room = this.roomManager.getRoom(ws.roomId);
    if (!room) {
      this.send(ws, 'error', { message: 'Room no longer exists' });
      ws.roomId = null;
      return null;
    }
    return room;
  }

  send(ws, type, data) {
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({ type, data }));
    }
  }
}

module.exports = SignalingHandler;
