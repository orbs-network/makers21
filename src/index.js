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

// Import Deepstream for multiplayer networking
import { DeepstreamClient } from '@deepstream/client';

// Import core modules
import gameState from './core/GameState.js';
import networkService from './services/NetworkService.js';
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
  // deepstream.js removed - NetworkService handles all network communication
  await import('./components/game.js');
}

// Default server address
const DEFAULT_SERVER = 'ws-makers.orbs.com';
const WS_PORT = 6020;

// Determine protocol once
const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss://' : 'ws://';

/**
 * Get server address from URL param or show dialog
 * @returns {Promise<string>} Server address (without protocol)
 */
async function getServerAddress() {
  const urlParams = new URLSearchParams(window.location.search);
  const serverParam = urlParams.get('server');

  if (serverParam) {
    console.log('Using server from URL param:', serverParam);
    return serverParam;
  }

  return promptForServer();
}

/**
 * Show server dialog and wait for user input
 * @param {string} [errorMsg] - Optional error message to display
 * @returns {Promise<string>} Server address (without protocol)
 */
function promptForServer(errorMsg) {
  return new Promise((resolve) => {
    // Hide connecting overlay, show dialog
    document.getElementById('server-connecting').style.display = 'none';

    const dialog = document.getElementById('server-dialog');
    const input = document.getElementById('server-input');
    const connectBtn = document.getElementById('server-connect');
    const status = document.getElementById('server-status');
    const protocolLabel = document.getElementById('server-protocol');
    const portLabel = document.getElementById('server-port');

    // Set protocol prefix and port suffix
    protocolLabel.textContent = WS_PROTOCOL;
    portLabel.textContent = `:${WS_PORT}`;

    // Reset to input state
    input.value = input.value || DEFAULT_SERVER;
    input.disabled = false;
    connectBtn.style.display = '';
    dialog.style.display = 'flex';

    // Show error from previous attempt
    if (errorMsg) {
      status.style.display = 'block';
      status.style.color = '#ff6b6b';
      status.textContent = errorMsg;
    } else {
      status.style.display = 'none';
    }

    // Clone to remove old listeners
    const newBtn = connectBtn.cloneNode(true);
    connectBtn.parentNode.replaceChild(newBtn, connectBtn);

    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);

    const handleConnect = () => {
      const server = newInput.value.trim();
      if (server) {
        dialog.style.display = 'none';
        // Update URL with the selected server (without reload)
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('server', server);
        window.history.replaceState({}, '', newUrl);
        resolve(server);
      }
    };

    newBtn.addEventListener('click', handleConnect);
    newInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleConnect();
    });
  });
}

/**
 * Show the connecting overlay with animated progress bar.
 * @param {string} serverHost - Server being connected to
 * @param {number} timeoutMs - Timeout duration for progress animation
 */
function showConnectingOverlay(serverHost, timeoutMs = 5000) {
  document.getElementById('server-dialog').style.display = 'none';
  const overlay = document.getElementById('server-connecting');
  const text = document.getElementById('connecting-text');
  const bar = document.getElementById('connect-progress');

  text.textContent = `Connecting to ${WS_PROTOCOL}${serverHost}:${WS_PORT}...`;
  bar.style.transition = 'none';
  bar.style.width = '0%';
  overlay.style.display = 'flex';

  // Animate progress bar to ~90% over the timeout duration
  requestAnimationFrame(() => {
    bar.style.transition = `width ${timeoutMs}ms linear`;
    bar.style.width = '90%';
  });
}

/**
 * Attempt to connect to server with a timeout.
 * @param {string} serverHost - Server address (without protocol)
 * @param {number} timeoutMs - Timeout in ms
 * @returns {Promise<DeepstreamClient>} Connected client
 */
function connectWithTimeout(serverHost, timeoutMs = 5000) {
  const serverAddress = `${WS_PROTOCOL}${serverHost}:${WS_PORT}`;
  console.log('Connecting to server:', serverAddress);

  const client = new DeepstreamClient(serverAddress, { subscriptionTimeout: 3000 });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { client.close(); } catch (e) { /* ignore */ }
      reject(new Error('Connection timed out'));
    }, timeoutMs);

    client.on('error', (error) => {
      clearTimeout(timer);
      try { client.close(); } catch (e) { /* ignore */ }
      reject(new Error(error));
    });

    client.login().then(() => {
      clearTimeout(timer);
      resolve(client);
    }).catch((err) => {
      clearTimeout(timer);
      try { client.close(); } catch (e) { /* ignore */ }
      reject(err);
    });
  });
}

/**
 * Show camera prompt if user hasn't explicitly disabled neck controls.
 * Sets localStorage 'disableNeck' based on choice.
 */
function promptCameraChoice() {
  // Skip if user already made a choice previously
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

  // Connection loop: get server address, attempt connection, retry on failure
  let deepStreamClient;
  let serverHost = await getServerAddress();

  while (!deepStreamClient) {
    showConnectingOverlay(serverHost);
    try {
      deepStreamClient = await connectWithTimeout(serverHost);
    } catch (err) {
      console.warn('Connection failed:', err.message);
      serverHost = await promptForServer(`Failed to connect to ${WS_PROTOCOL}${serverHost}:${WS_PORT} — ${err.message}`);
    }
  }

  // Hide overlays
  document.getElementById('server-connecting').style.display = 'none';
  document.getElementById('server-dialog').style.display = 'none';
  await networkService.init(deepStreamClient);

  // Prompt for camera/face tracking if not already decided
  await promptCameraChoice();
  // Update gameState in case the prompt just changed the setting
  gameState.settings.useNeck = localStorage.getItem('disableNeck') !== 'true';

  // Create and initialize the game
  const game = new Game();
  window.game = game; // Expose globally for components

  // Create world first
  game.createWorld();

  // Load game assets and initialize
  game.loadAsync(() => {
    console.log('Game assets loaded, initializing...');

    // Initialize UI
    game.uxInit();

    // Create scene and setup controls
    game.world.createScene();
    game.initControls(false);
    game.world.setTeamPos(null);

    // Connect to game server
    game.connect();

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

  // Handle window blur (pause game when not focused)
  window.addEventListener('blur', () => {
    if (game.onblur) {
      game.onblur();
    }
  });
});