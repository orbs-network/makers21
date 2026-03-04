/**
 * NetworkService - Handles all network communication via DeepStream
 * Extracted from game.js and deepstream.js for better separation of concerns.
 */
class NetworkService {
  constructor() {
    this.client = null;
    this.uuid = null;
    this.connected = false;
    this._eventHandlers = new Map();
  }

  /**
   * Initialize the network service with a DeepStream client
   * @param {Object} deepStreamClient - DeepStream client instance
   * @returns {Promise} - Resolves when connected
   */
  async init(deepStreamClient) {
    this.client = deepStreamClient;
    this.uuid = window.deepStreamUUID || deepStreamClient.getUid();

    this.client.on('error', (error, event, topic) => {
      console.error('DeepStream error:', error, event, topic);
    });

    this.client.on('connectionStateChanged', (connectionState) => {
      console.log('Connection state changed:', connectionState);
      this.connected = connectionState === 'OPEN';
    });

    // Wait for login to complete before returning
    await this.client.login();
    console.log('NetworkService: logged in successfully');
  }

  /**
   * Make an async RPC call to the server
   * @param {string} type - RPC type
   * @param {Object} data - Data to send
   * @returns {Promise<*>} - Server response
   */
  async rpcMake(type, data = {}) {
    return new Promise((resolve, reject) => {
      this.client.rpc.make('client', { type, ...data }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Subscribe to an event
   * @param {string} name - Event name
   * @param {Function} handler - Event handler
   */
  subscribe(name, handler) {
    const wrappedHandler = (data) => {
      // Ignore own events
      if (data.id === this.uuid) {
        return;
      }
      handler(data);
    };

    this.client.event.subscribe(name, wrappedHandler);
    this._eventHandlers.set(name, wrappedHandler);
  }

  /**
   * Unsubscribe from an event
   * @param {string} name - Event name
   */
  unsubscribe(name) {
    const handler = this._eventHandlers.get(name);
    if (handler) {
      this.client.event.unsubscribe(name, handler);
      this._eventHandlers.delete(name);
    }
  }

  /**
   * Send an event
   * @param {string} name - Event name
   * @param {Object} data - Data to send
   */
  sendEvent(name, data) {
    data.id = this.uuid;
    this.client.event.emit(name, data);
  }

  /**
   * Throttled event sending (for position updates)
   */
  _throttleTimeout = null;
  _throttlePrevious = 0;
  _throttleWait = 1000;

  sendEventThrottled(name, data) {
    const now = Date.now();
    const remaining = this._throttleWait - (now - this._throttlePrevious);

    if (remaining <= 0 || remaining > this._throttleWait) {
      this._throttlePrevious = now;
      this.sendEvent(name, data);
    }
  }

  // ============= Game-specific RPC methods =============

  /**
   * Check if server is online and get initial state
   * @returns {Promise<Object>} - Server state
   */
  async checkOnline() {
    return this.rpcMake('online');
  }

  /**
   * Join a team
   * @param {string} nick - Player nickname
   * @param {boolean} isRed - True for red team
   * @returns {Promise<string>} - 'ok' or error message
   */
  async join(nick, isRed) {
    return this.rpcMake('join', { nick, isRed });
  }

  /**
   * Leave the game
   * @param {string} nick - Player nickname
   * @param {boolean} isRed - Player's team
   * @returns {Promise<string>} - 'ok' or error message
   */
  async leave(nick, isRed) {
    return this.rpcMake('leave', { nick, isRed });
  }

  /**
   * Request game start
   * @param {string} nick - Player nickname
   * @returns {Promise<*>} - Server response
   */
  async start(nick) {
    return this.rpcMake('start', { nick });
  }

  /**
   * Request game reset
   * @param {string} nick - Player nickname
   * @returns {Promise<*>} - Server response
   */
  async reset(nick) {
    return this.rpcMake('reset', { nick });
  }

  /**
   * Report gate pass
   * @param {string} nick - Player nickname
   * @param {boolean} isRed - Player's team
   * @param {boolean} winGate - Whether this is a winning gate pass
   * @returns {Promise<string>} - 'ok' or error message
   */
  async gatePass(nick, isRed, winGate) {
    return this.rpcMake('gatePass', { nick, isRed, winGate });
  }

  /**
   * Report flag drop
   * @param {string} nick - Player nickname
   * @param {boolean} isRed - Player's team
   * @returns {Promise<string>} - 'ok' or error message
   */
  async flagDrop(nick, isRed) {
    return this.rpcMake('flagDrop', { nick, isRed });
  }

  /**
   * Pass flag to another player
   * @param {string} nick - Player nickname
   * @param {boolean} isRed - Player's team
   * @param {string} targetNick - Target player nickname
   * @returns {Promise<string>} - 'ok' or error message
   */
  async passFlag(nick, isRed, targetNick) {
    return this.rpcMake('passFlag', { nick, isRed, targetNick });
  }

  /**
   * Broadcast player position
   * @param {Object} positionData - Position data to broadcast
   */
  broadcastPosition(positionData) {
    this.sendEventThrottled('player', positionData);
  }
}

// Export singleton instance
const networkService = new NetworkService();

// Make available globally during migration
window.networkService = networkService;

export default networkService;
