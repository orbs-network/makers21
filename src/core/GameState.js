/**
 * Centralized Game State Manager
 * Manages all game state in one place with subscription support for reactive updates.
 */
class GameState {
  constructor() {
    // Local player state (persisted to localStorage)
    this.local = {
      nick: localStorage.getItem('nick') || '',
      isRed: localStorage.getItem('isRed') === 'true',
    };

    // Game play state
    this.game = {
      moving: false,
      exploding: false,
      holdingFlag: false,
      passingGate: null,
      gameOver: false,
      first: true,
      tellingGatePass: false,
    };

    // Manager state (from server)
    this.manager = {
      red: [],
      blue: [],
      started: false,
      startTs: 0,
      redHolder: null,
      blueHolder: null,
      winnerNick: null,
      winnerIsRed: null,
      needReset: false,
    };

    // Settings (from localStorage)
    this.settings = {
      useNeck: localStorage.getItem('disableNeck') !== 'true',
      stillTargetEnabled: localStorage.getItem('stillTargetEnabled') === 'true',
      disableConstantSpeed: localStorage.getItem('disableConstantSpeed') === 'true',
      disableSound: localStorage.getItem('disableSound') === 'true',
    };

    // Listeners for state changes
    this._listeners = new Set();
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function(path, value, oldValue)
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Notify all listeners of a state change
   * @param {string} path - Dot-notation path to changed value
   * @param {*} value - New value
   * @param {*} oldValue - Previous value
   */
  _notify(path, value, oldValue) {
    this._listeners.forEach((listener) => {
      try {
        listener(path, value, oldValue);
      } catch (e) {
        console.error('GameState listener error:', e);
      }
    });
  }

  /**
   * Update a value at a dot-notation path
   * @param {string} path - Path like 'game.moving' or 'local.nick'
   * @param {*} value - New value to set
   */
  update(path, value) {
    const parts = path.split('.');
    let obj = this;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (!obj) {
        console.error(`GameState: Invalid path ${path}`);
        return;
      }
    }
    const key = parts[parts.length - 1];
    const oldValue = obj[key];
    if (oldValue !== value) {
      obj[key] = value;
      this._notify(path, value, oldValue);
    }
  }

  /**
   * Get a value at a dot-notation path
   * @param {string} path - Path like 'game.moving' or 'local.nick'
   * @returns {*} Value at path
   */
  get(path) {
    const parts = path.split('.');
    let obj = this;
    for (const part of parts) {
      obj = obj[part];
      if (obj === undefined) return undefined;
    }
    return obj;
  }

  /**
   * Update multiple values at once
   * @param {Object} updates - Object with path: value pairs
   */
  updateMany(updates) {
    for (const [path, value] of Object.entries(updates)) {
      this.update(path, value);
    }
  }

  /**
   * Save local state to localStorage
   */
  saveLocal() {
    localStorage.setItem('nick', this.local.nick);
    localStorage.setItem('isRed', this.local.isRed);
  }

  /**
   * Load local state from localStorage
   */
  loadLocal() {
    this.local.nick = localStorage.getItem('nick') || '';
    this.local.isRed = localStorage.getItem('isRed') === 'true';
  }

  /**
   * Update manager state from server response
   * @param {Object} state - State object from server
   */
  updateManagerState(state) {
    if (!state) return;

    // Update manager state properties
    if (state.red !== undefined) this.update('manager.red', state.red);
    if (state.blue !== undefined) this.update('manager.blue', state.blue);
    if (state.started !== undefined) this.update('manager.started', state.started);
    if (state.startTs !== undefined) this.update('manager.startTs', state.startTs);
    if (state.redHolder !== undefined) this.update('manager.redHolder', state.redHolder);
    if (state.blueHolder !== undefined) this.update('manager.blueHolder', state.blueHolder);
    if (state.winnerNick !== undefined) this.update('manager.winnerNick', state.winnerNick);
    if (state.winnerIsRed !== undefined) this.update('manager.winnerIsRed', state.winnerIsRed);
    if (state.needReset !== undefined) this.update('manager.needReset', state.needReset);
  }

  /**
   * Check if local player has joined a team
   * @returns {boolean}
   */
  isJoined() {
    return (
      this.manager.red.includes(this.local.nick) ||
      this.manager.blue.includes(this.local.nick)
    );
  }

  /**
   * Reset game state (for new game)
   */
  resetGame() {
    this.update('game.moving', false);
    this.update('game.exploding', false);
    this.update('game.holdingFlag', false);
    this.update('game.passingGate', null);
    this.update('game.gameOver', false);
    this.update('game.first', true);
    this.update('game.tellingGatePass', false);
  }
}

// Export singleton instance
const gameState = new GameState();

// Make available globally for gradual migration
window.gameState = gameState;

export default gameState;
