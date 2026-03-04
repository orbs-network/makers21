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

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load game modules first (THREE is now available)
  await loadGameModules();
  console.log('Makers21 - Three.js Version Loading...');

  // Check for server override in URL params (e.g., ?server=localhost:6020)
  const urlParams = new URLSearchParams(window.location.search);
  const serverParam = urlParams.get('server');

  // Determine server address
  let serverAddress;
  if (serverParam) {
    // Use ws:// for localhost, wss:// for remote
    const protocol = serverParam.includes('localhost') || serverParam.includes('127.0.0.1') ? 'ws://' : 'wss://';
    serverAddress = protocol + serverParam;
    console.log('Using server override:', serverAddress);
  } else {
    serverAddress = 'wss://ws-makers.orbs.com:6021';
    console.log('Using default server:', serverAddress);
  }

  // Initialize Deepstream client
  const deepStreamClient = new DeepstreamClient(serverAddress, {
    subscriptionTimeout: 3000
  });

  // Initialize network service with the Deepstream client (wait for connection)
  await networkService.init(deepStreamClient);

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