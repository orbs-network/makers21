// Import styles
import '@/components/style.css';

// Import core Three.js and required libraries FIRST
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Import official Three.js postprocessing
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';

// Make Three.js and loaders available globally IMMEDIATELY
window.THREE = THREE;
window.THREE.OBJLoader = OBJLoader;
window.THREE.MTLLoader = MTLLoader;
window.THREE.FirstPersonControls = FirstPersonControls;
window.THREE.CSS2DRenderer = CSS2DRenderer;
window.THREE.CSS2DObject = CSS2DObject;

// Set up THREE postprocessing classes globally
window.THREE.EffectComposer = EffectComposer;
window.THREE.RenderPass = RenderPass;
window.THREE.AfterimagePass = AfterimagePass;

// Import MediaPipe for face tracking and expose globally
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { FaceMesh, FACEMESH_TESSELATION } from '@mediapipe/face_mesh';
window.Camera = Camera;
window.FaceMesh = FaceMesh;
window.drawConnectors = drawConnectors;
window.drawLandmarks = drawLandmarks;
window.FACEMESH_TESSELATION = FACEMESH_TESSELATION;

// Import WebRTCService (replaces DeepStream NetworkService)
import networkService from './services/WebRTCService.js';

// Import core modules
import gameState from './core/GameState.js';
import uiService from './services/UIService.js';

// Make modules available globally during migration
window.gameState = gameState;
window.networkService = networkService;
window.uiService = uiService;

// Load game components dynamically after THREE is set up
async function loadGameModules() {
  await import('./assets/jsm/obejcts/Sky.js');
  await import('./assets/jsm/obejcts/Lensflare.js');
  await import('./assets/jsm/ImprovedNoise.js');
  await import('./assets/jsm/postprocessing/Pass.js');
  await import('./assets/jsm/shaders/LuminosityHighPassShader.js');
  await import('./assets/jsm/shaders/CopyShader.js');
  await import('./assets/jsm/postprocessing/UnrealBloomPass.js');
  await import('./components/config.js');
  await import('./components/factory.js');
  await import('./components/materials.js');
  await import('./components/laser.js');
  await import('./components/shooting.js');
  await import('./components/flag.js');
  await import('./components/physics.js');
  await import('./components/explode.js');
  await import('./components/threex.spaceships.js');
  await import('./components/world.js');
  await import('./components/players.js');
  await import('./components/face.js');
  await import('./components/neckControls.js');
  await import('./components/sound.js');
  await import('./components/game.js');
}

/**
 * Get game params from URL (set by lobby redirect)
 */
function getGameParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomId: params.get('roomId'),
    team: params.get('team'),       // 'A' or 'B'
    nick: params.get('nick'),
    server: params.get('server'),   // optional server override
  };
}

/**
 * Build WS URL for the server
 */
function getWsUrl(serverOverride) {
  if (serverOverride) {
    const proto = serverOverride.startsWith('https') ? 'wss:' : 'ws:';
    return `${proto}//${serverOverride}/ws`;
  }
  // Production override (e.g. wss://ws-makers.orbs.com/ws) — set on the
  // server via WS_URL env var, injected through /runtime-config.js.
  if (window.MAKERS21_CONFIG && window.MAKERS21_CONFIG.wsUrl) {
    return window.MAKERS21_CONFIG.wsUrl;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
}

/**
 * Show camera prompt if user hasn't explicitly disabled neck controls.
 */
function promptCameraChoice() {
  if (localStorage.getItem('disableNeck') !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const dialog = document.getElementById('camera-prompt');
    dialog.style.display = 'flex';

    document.getElementById('camera-enable').addEventListener('click', () => {
      localStorage.setItem('disableNeck', 'false');
      dialog.style.display = 'none';
      resolve();
    });

    document.getElementById('camera-skip').addEventListener('click', () => {
      localStorage.setItem('disableNeck', 'true');
      dialog.style.display = 'none';
      resolve();
    });
  });
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load game modules first (THREE is now available)
  await loadGameModules();
  console.log('Makers21 - Three.js Version Loading...');

  // Get params from URL (set by lobby)
  const { roomId, team, nick, server } = getGameParams();

  if (!roomId || !nick) {
    // No room params — redirect back to lobby
    console.warn('No roomId/nick in URL, redirecting to lobby');
    window.location.href = '/';
    return;
  }

  // Set local state from URL params
  const isRed = team === 'A';
  gameState.update('local.nick', nick);
  gameState.update('local.isRed', isRed);
  gameState.saveLocal();

  // Show loading overlay
  const overlay = document.getElementById('server-connecting');
  const loadingText = document.getElementById('connecting-text');
  const loadingBar = document.getElementById('connect-progress');
  overlay.style.display = 'flex';

  loadingText.textContent = `Joining room ${roomId}...`;
  loadingBar.style.width = '20%';

  // Redirect back to lobby with error hint
  function backToLobby(errorMessage) {
    const params = new URLSearchParams();
    if (errorMessage) params.set('error', errorMessage);
    window.location.href = `/${params.toString() ? '?' + params.toString() : ''}`;
  }

  // Connect to server via WebRTCService
  try {
    const wsUrl = getWsUrl(server);

    // Subscribe to errors BEFORE joining so we catch room-not-found etc.
    networkService.subscribe('error', (data) => {
      const msg = (data && data.message) || '';
      // Fatal join-time errors: redirect back to lobby
      if (/room not found|room is locked|nickname already taken|room is full/i.test(msg)) {
        backToLobby(msg);
      }
    });

    // The lobby already started the game, so gameState events will arrive via WS
    await networkService.init({
      serverUrl: wsUrl,
      roomId,
      nick,
      team,
      rtpCapabilities: null,
    });
  } catch (err) {
    backToLobby(`Failed to connect: ${err.message}`);
    return;
  }

  loadingText.textContent = 'Connected. Setting up...';
  loadingBar.style.width = '40%';

  // Listen for roomState which contains rtpCapabilities, then set up mediasoup
  networkService.subscribe('roomState', async (data) => {
    if (data.rtpCapabilities && !networkService.device) {
      try {
        await networkService.setupMediasoup(data.rtpCapabilities);
        console.log('mediasoup data channels established');
      } catch (err) {
        console.warn('mediasoup setup failed, continuing with WS fallback', err);
      }
    }
  });

  // Prompt for camera/face tracking
  await promptCameraChoice();
  gameState.settings.useNeck = localStorage.getItem('disableNeck') !== 'true';

  // Create and initialize the game
  loadingText.textContent = 'Loading game assets...';
  loadingBar.style.width = '50%';
  const game = new Game();
  window.game = game;

  game.createWorld();

  game.loadAsync(() => {
    console.log('Game assets loaded, initializing...');
    loadingText.textContent = 'Creating scene...';
    loadingBar.style.width = '80%';

    // Initialize UI
    game.uxInit();

    // Create scene and setup controls
    game.world.createScene();
    game.initControls(false);
    game.world.setTeamPos(isRed);
    game.world.setNick(nick);

    loadingText.textContent = 'Connecting to game...';
    loadingBar.style.width = '95%';

    // Connect to game server
    game.connect();

    // Hide loading overlay
    loadingBar.style.width = '100%';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 300);

    // Start the render loop
    function animate() {
      requestAnimationFrame(animate);
      game.render();
    }
    animate();

    console.log('Makers21 game initialized successfully!');
  });

  // Handle window resize
  window.addEventListener('resize', (e) => {
    if (game.world) {
      game.world.onresize(e);
    }
  });

  // Handle window blur
  window.addEventListener('blur', () => {
    if (game.onblur) {
      game.onblur();
    }
  });
});
