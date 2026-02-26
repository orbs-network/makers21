/**
 * UIService - Handles all DOM manipulation and UI state
 * Extracted from game.js for better separation of concerns.
 */
class UIService {
  constructor() {
    this._elements = {};
    this._handlers = {};
    this._countdownInterval = null;
    this._fpsInterval = null;
    this._frames = 0;
  }

  /**
   * Cache DOM element references for performance
   */
  cacheElements() {
    this._elements = {
      join: document.getElementById('join'),
      leave: document.getElementById('leave'),
      start: document.getElementById('start'),
      reset: document.getElementById('reset'),
      nick: document.getElementById('nick'),
      red: document.getElementById('red'),
      blue: document.getElementById('blue'),
      chooseTeam: document.getElementById('choose-team'),
      gameDisplay: document.getElementById('game-display'),
      msg: document.getElementById('msg'),
      welcome: document.getElementById('welcome'),
      reqStart: document.getElementById('req-start'),
      gameOver: document.getElementById('game-over'),
      winnerNick: document.getElementById('winnerNick'),
      winnerIsRed: document.getElementById('winnerIsRed'),
      online: document.getElementById('online'),
      fps: document.getElementById('fps'),
    };
  }

  /**
   * Initialize UI event handlers
   * @param {Object} handlers - Object with handler functions
   */
  init(handlers) {
    this.cacheElements();
    this._handlers = handlers;

    // Button click handlers
    if (this._elements.join && handlers.onJoin) {
      this._elements.join.addEventListener('click', handlers.onJoin);
    }
    if (this._elements.leave && handlers.onLeave) {
      this._elements.leave.addEventListener('click', handlers.onLeave);
    }
    if (this._elements.start && handlers.onStart) {
      this._elements.start.addEventListener('click', handlers.onStart);
    }
    if (this._elements.reset && handlers.onReset) {
      this._elements.reset.addEventListener('click', handlers.onReset);
    }

    // Keyboard handler
    if (handlers.onKeydown) {
      document.body.addEventListener('keydown', handlers.onKeydown);
    }

    // Nick input handler
    if (this._elements.nick && handlers.onNickChange) {
      this._elements.nick.addEventListener('input', (e) => {
        const value = e.target.value;
        this.showChooseTeam(value.length > 2);
        handlers.onNickChange(value);
      });
    }
  }

  /**
   * Set form inputs from state
   * @param {string} nick - Player nickname
   * @param {boolean} isRed - Is red team selected
   */
  setInputs(nick, isRed) {
    if (this._elements.nick) {
      this._elements.nick.setAttribute('value', nick || '');
    }
    if (this._elements.red) {
      this._elements.red.checked = isRed;
    }
    if (this._elements.blue) {
      this._elements.blue.checked = !isRed;
    }
    this.showChooseTeam(nick && nick.length > 2);
  }

  /**
   * Show/hide choose team section
   * @param {boolean} show - Whether to show
   */
  showChooseTeam(show) {
    if (this._elements.chooseTeam) {
      this._elements.chooseTeam.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Display a game message
   * @param {string} html - Message HTML content
   */
  setGameMsg(html) {
    if (this._elements.gameDisplay) {
      this._elements.gameDisplay.style.display = html ? 'block' : 'none';
    }
    if (this._elements.msg) {
      this._elements.msg.innerHTML = html || '';
    }
  }

  /**
   * Show connection status
   * @param {string} status - Status text
   */
  setOnlineStatus(status) {
    if (this._elements.online) {
      this._elements.online.innerText = status;
    }
  }

  /**
   * Show welcome screen
   */
  showWelcome() {
    if (this._elements.welcome) {
      this._elements.welcome.style.display = 'block';
    }
    if (this._elements.gameDisplay) {
      this._elements.gameDisplay.style.display = 'none';
    }
    if (this._elements.reqStart) {
      this._elements.reqStart.style.display = 'none';
    }
  }

  /**
   * Hide welcome screen and show game display
   */
  showGameDisplay() {
    if (this._elements.welcome) {
      this._elements.welcome.style.display = 'none';
    }
    if (this._elements.gameDisplay) {
      this._elements.gameDisplay.style.display = 'block';
    }
  }

  /**
   * Show request start button
   */
  showRequestStart() {
    if (this._elements.reqStart) {
      this._elements.reqStart.style.display = 'block';
    }
  }

  /**
   * Start countdown display
   * @param {number} startTs - Start timestamp
   * @param {Function} onTick - Callback on each tick (seconds, tenth)
   * @param {Function} onComplete - Callback when countdown completes
   */
  startCountdown(startTs, onTick, onComplete) {
    this.stopCountdown();

    this._countdownInterval = setInterval(() => {
      const diff = startTs - Date.now();
      if (diff > 0) {
        const seconds = Math.floor(diff / 1000);
        const tenth = parseInt((new Date(diff)).getMilliseconds() / 100);
        this.setGameMsg(`GAME BEGINS IN ${seconds}:${tenth}`);
        if (onTick) {
          onTick(seconds, tenth);
        }
      } else {
        this.stopCountdown();
        if (onComplete) {
          onComplete();
        }
      }
    }, 50);
  }

  /**
   * Stop countdown
   */
  stopCountdown() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  /**
   * Show game over screen
   * @param {string} winnerNick - Winner's nickname
   * @param {boolean} winnerIsRed - Whether winner is red team
   */
  showGameOver(winnerNick, winnerIsRed) {
    const winnerTeam = winnerIsRed ? 'red' : 'blue';

    if (this._elements.gameOver) {
      this._elements.gameOver.style.display = 'block';
      this._elements.gameOver.className = winnerTeam;
    }
    if (this._elements.winnerNick) {
      this._elements.winnerNick.innerHTML = `${winnerNick} has captured the flag!`;
    }
    if (this._elements.winnerIsRed) {
      this._elements.winnerIsRed.innerHTML = `${winnerTeam.toUpperCase()} TEAM IS THE WINNER`;
    }
  }

  /**
   * Hide game over screen
   */
  hideGameOver() {
    if (this._elements.gameOver) {
      this._elements.gameOver.style.display = 'none';
    }
  }

  /**
   * Start FPS counter
   */
  startFPSCounter() {
    this._frames = 0;
    this._fpsInterval = setInterval(() => {
      if (this._elements.fps) {
        this._elements.fps.innerHTML = 'FPS: ' + this._frames;
      }
      this._frames = 0;
    }, 1000);
  }

  /**
   * Increment frame count (call each render)
   */
  incrementFrame() {
    this._frames++;
  }

  /**
   * Stop FPS counter
   */
  stopFPSCounter() {
    if (this._fpsInterval) {
      clearInterval(this._fpsInterval);
      this._fpsInterval = null;
    }
  }

  /**
   * Get whether red team is selected
   * @returns {boolean}
   */
  isRedSelected() {
    return this._elements.red ? this._elements.red.checked : false;
  }

  /**
   * Cleanup
   */
  dispose() {
    this.stopCountdown();
    this.stopFPSCounter();
  }
}

// Export singleton instance
const uiService = new UIService();

// Make available globally during migration
window.uiService = uiService;

export default uiService;
