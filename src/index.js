// Import styles
import '@/components/style.css';

// Import core Three.js and required libraries FIRST
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FirstPersonControls } from 'three/addons/controls/FirstPersonControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// Make Three.js and loaders available globally IMMEDIATELY
window.THREE = THREE;
window.THREE.OBJLoader = OBJLoader;
window.THREE.MTLLoader = MTLLoader;
window.THREE.FirstPersonControls = FirstPersonControls;
window.THREE.CSS2DRenderer = CSS2DRenderer;
window.THREE.CSS2DObject = CSS2DObject;

// Import Deepstream for multiplayer networking
import { DeepstreamClient } from '@deepstream/client';

// Import game components
import './components/config.js';

// Import game modules (postprocessing will be loaded dynamically)
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

// Load postprocessing modules dynamically after THREE is set up
async function loadPostprocessing() {
  await import('./components/postprocessing/Pass.js');
  await import('./components/postprocessing/MaskPass.js');
  await import('./components/postprocessing/ShaderPass.js');
  await import('./components/postprocessing/EffectsComposer.js');
  await import('./components/postprocessing/RenderPass.js');
  await import('./components/postprocessing/AfterimageShader.js');
  await import('./components/postprocessing/AfterimagePass.js');

  // Set up THREE postprocessing classes globally
  window.THREE.EffectComposer = window.EffectComposer;
  window.THREE.RenderPass = window.RenderPass;
  window.THREE.AfterimagePass = window.AfterimagePass;
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Makers21 - Three.js Version Loading...');

  // Load postprocessing modules first
  await loadPostprocessing();

  // Initialize Deepstream connection
  window.deepStream = {
    client: new DeepstreamClient('localhost:6020')
  };

  // Create and initialize the game
  const game = new Game();

  // Connect to server and start the game
  game.connect();
  game.createWorld();

  // Load game assets and start
  game.loadAsync(() => {
    console.log('Game assets loaded, initializing UI...');
    game.uxInit();

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