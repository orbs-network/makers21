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

// Import game components
import './components/config.js';

// Import game modules
import './components/factory.js';
import './components/materials.js';
import './components/laser.js';
import './components/shooting.js';
import './components/flag.js';
import './components/physics.js';
import './components/explode.js';
import './components/threex.spaceships.js';
import './components/world.js';
import './components/players.js';
import './components/face.js';
import './components/neckControls.js';
import './components/sound.js';
import './components/deepstream.js';
import './components/game.js';

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Makers21 - Three.js Version Loading...');

  // Initialize Deepstream client
  const deepStreamClient = new DeepstreamClient('wss://ws-makers.orbs.com:6021', {
    subscriptionTimeout: 3000
  });

  // Initialize network service with the Deepstream client
  networkService.init(deepStreamClient);

  // Create and initialize the game
  const game = new Game();

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