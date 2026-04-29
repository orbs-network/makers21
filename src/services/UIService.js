/**
 * UIService - Handles in-game DOM manipulation.
 * Lobby UI lives in the lobby page (server-v2/public/) — this only handles
 * the in-game HUD, countdown, game-over screen, and FPS counter.
 */
class UIService {
  constructor() {
    this._elements = {};
    this._countdownInterval = null;
    this._fpsInterval = null;
    this._frames = 0;
  }

  cacheElements() {
    this._elements = {
      gameDisplay: document.getElementById('game-display'),
      msg: document.getElementById('msg'),
      gameOver: document.getElementById('game-over'),
      winnerNick: document.getElementById('winnerNick'),
      winnerIsRed: document.getElementById('winnerIsRed'),
      playAgain: document.getElementById('play-again'),
      fps: document.getElementById('fps'),
    };
  }

  init(handlers) {
    this.cacheElements();
    this._handlers = handlers;

    if (this._elements.playAgain && handlers.onReset) {
      this._elements.playAgain.addEventListener('click', handlers.onReset);
    }

    if (handlers.onKeydown) {
      document.body.addEventListener('keydown', handlers.onKeydown);
    }
  }

  setGameMsg(html) {
    if (this._elements.gameDisplay) {
      this._elements.gameDisplay.style.display = html ? 'block' : 'none';
    }
    if (this._elements.msg) {
      this._elements.msg.innerHTML = html || '';
    }
  }

  showGameDisplay() {
    if (this._elements.gameDisplay) {
      this._elements.gameDisplay.style.display = 'block';
    }
  }

  startCountdown(startTs, onTick, onComplete) {
    this.stopCountdown();

    this._countdownInterval = setInterval(() => {
      const diff = startTs - Date.now();
      if (diff > 0) {
        const seconds = Math.floor(diff / 1000);
        const tenth = parseInt((new Date(diff)).getMilliseconds() / 100);
        this.setGameMsg(`GAME BEGINS IN ${seconds}:${tenth}`);
        if (onTick) onTick(seconds, tenth);
      } else {
        this.stopCountdown();
        if (onComplete) onComplete();
      }
    }, 50);
  }

  stopCountdown() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  showGameOver(winnerNick, winnerIsRed) {
    const winnerTeam = winnerIsRed ? 'red' : 'blue';

    if (this._elements.gameDisplay) {
      this._elements.gameDisplay.style.display = 'none';
    }
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

  hideGameOver() {
    if (this._elements.gameOver) {
      this._elements.gameOver.style.display = 'none';
    }
  }

  startFPSCounter() {
    this._frames = 0;
    this._fpsInterval = setInterval(() => {
      if (this._elements.fps) {
        this._elements.fps.innerHTML = 'FPS: ' + this._frames;
      }
      this._frames = 0;
    }, 1000);
  }

  incrementFrame() {
    this._frames++;
  }

  stopFPSCounter() {
    if (this._fpsInterval) {
      clearInterval(this._fpsInterval);
      this._fpsInterval = null;
    }
  }

  dispose() {
    this.stopCountdown();
    this.stopFPSCounter();
  }

  // --- no-op stubs for legacy callers in game.js ---
  // These were lobby-related methods. The lobby is now a separate page.
  setOnlineStatus() {}
  showWelcome() {}
  showLobby() {}
  showWaitingForNextGame() {}
  showRequestStart() {}
  setInputs() {}
  isRedSelected() { return false; }
  showChooseTeam() {}
}

const uiService = new UIService();
window.uiService = uiService;
export default uiService;
