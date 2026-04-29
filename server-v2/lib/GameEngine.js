const config = require('../config');

class GameEngine {
  /**
   * @param {function} onStateChange - callback receiving the full game state whenever it changes
   */
  constructor(onStateChange) {
    this.onStateChange = onStateChange;
    this.resetState();

    // activity tracking for disconnect detection
    this.lastActivity = {};
    this.disconnectChecker = setInterval(() => this.checkDisconnects(), 5000);
  }

  resetState() {
    this.state = {
      started: false,
      ready: false,
      red: [],
      blue: [],
      redHolder: null,
      blueHolder: null,
      winnerNick: null,
      winnerIsRed: false,
      startTs: null,
    };
    this.lastActivity = {};
  }

  destroy() {
    clearInterval(this.disconnectChecker);
  }

  // --- public API (called by Room) ---

  onJoin(nick, isRed) {
    if (this.state.started) {
      return { error: 'Game already started' };
    }
    const add = isRed ? this.state.red : this.state.blue;
    const rmv = isRed ? this.state.blue : this.state.red;

    if (add.length >= config.maxTeamSize) {
      return { error: `Team is full (max ${config.maxTeamSize} players)` };
    }
    if (add.includes(nick)) {
      return { error: `Nickname [${nick}] is already on this team` };
    }

    add.push(nick);

    // remove from other team if switching
    const idx = rmv.indexOf(nick);
    if (idx > -1) rmv.splice(idx, 1);

    this.updateReady();
    this.tellState();
    return { ok: true };
  }

  onLeave(nick, isRed) {
    if (this.state.started) {
      return { error: 'Game already started' };
    }
    const team = isRed ? this.state.red : this.state.blue;
    const idx = team.indexOf(nick);
    if (idx > -1) team.splice(idx, 1);

    this.updateReady();
    this.tellState();
    return { ok: true };
  }

  onStart(nick) {
    if (this.state.started) {
      return { error: 'Game already started' };
    }

    const dt = new Date();
    dt.setSeconds(dt.getSeconds() + 4, 0);

    this.state.started = true;
    this.state.startedBy = nick;
    this.state.startTs = dt.getTime();
    this.state.winnerNick = null;
    this.state.winnerIsRed = false;

    console.log('Game start time:', dt.toISOString());
    this.tellState();
    return { ok: true };
  }

  onGatePass(nick, isRed, winGate) {
    console.log('onGatePass', nick, 'isRed:', isRed, 'winGate:', winGate);

    if (winGate) {
      this.state.winnerNick = nick;
      this.state.winnerIsRed = isRed === true;
      console.log('Winner:', nick, 'isRed:', this.state.winnerIsRed);
      this.tellState();
      return { ok: true };
    }

    const flagHolder = isRed ? 'blueHolder' : 'redHolder';

    if (!this.state[flagHolder]) {
      this.state[flagHolder] = nick;
      console.log('Flag captured by', nick);
      this.tellState();
      return { ok: true };
    }

    return { error: `${this.state[flagHolder]} has already captured the flag` };
  }

  onFlagDrop(nick, isRed) {
    console.log('onFlagDrop', nick, 'isRed:', isRed);
    const flagHolder = isRed ? 'blueHolder' : 'redHolder';

    if (this.state[flagHolder] === nick) {
      this.state[flagHolder] = null;
      console.log('Flag dropped by', nick);
      this.tellState();
      return { ok: true };
    }

    return { error: `The flag is not held by [${nick}]` };
  }

  onPassFlag(nick, isRed, targetNick) {
    const flagHolder = isRed ? 'blueHolder' : 'redHolder';

    if (this.state[flagHolder] !== nick) {
      return { error: `The flag is not held by [${nick}]` };
    }

    this.state[flagHolder] = targetNick;
    this.tellState();
    return { ok: true };
  }

  onReset() {
    this.resetState();
    this.state.needReset = true;
    this.tellState();
    this.state.needReset = false;
    return { ok: true };
  }

  // called when position data flows through (for activity tracking)
  trackActivity(nick) {
    this.lastActivity[nick] = Date.now();
  }

  // --- internal ---

  updateReady() {
    this.state.ready = this.state.red.length > 0 &&
      this.state.red.length === this.state.blue.length;
  }

  tellState() {
    this.onStateChange({ type: 'state', state: this.state });
  }

  checkDisconnects() {
    if (!this.state.started) return;
    const now = Date.now();
    const timeout = 10_000;

    for (const field of ['redHolder', 'blueHolder']) {
      const nick = this.state[field];
      if (nick && this.lastActivity[nick] && (now - this.lastActivity[nick] > timeout)) {
        console.log(`Auto-dropping flag: ${nick} inactive for ${timeout}ms`);
        this.state[field] = null;
        this.tellState();
      }
    }
  }
}

module.exports = GameEngine;
