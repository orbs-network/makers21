// Import A-Frame and required components
import 'aframe';
import 'aframe-environment-component';

// Import MediaPipe for face tracking
import '@mediapipe/camera_utils';
import '@mediapipe/drawing_utils';
import '@mediapipe/face_mesh';

// Import Deepstream for multiplayer networking
import { DeepstreamClient } from '@deepstream/client';

// Import A-Frame specific components
import './components/face.js';
import './components/game.js';
import './components/move.js';
import './components/deepstream.js';

// Initialize global variables for A-Frame version
let speed = parseFloat(localStorage.getItem("speed")) || 0.25;
let hFactor = parseFloat(localStorage.getItem("hFactor")) || 0.25;
let vFactor = parseFloat(localStorage.getItem("vFactor")) || 0.25;
let alttd = parseFloat(localStorage.getItem("alttd")) || 0.25;
let levelHrznRate = parseFloat(localStorage.getItem("levelHrznRate")) || 0.5;

// Make variables globally available
window.speed = speed;
window.hFactor = hFactor;
window.vFactor = vFactor;
window.alttd = alttd;
window.levelHrznRate = levelHrznRate;

// Initialize the A-Frame game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Makers21 - A-Frame Version Loading...');

  // Initialize Deepstream connection
  window.deepStream = {
    client: new DeepstreamClient('localhost:6020')
  };

  // Get player element
  const player = document.getElementById('player');
  window.player = player;

  // Setup control panel event listeners
  setupControlPanel();

  console.log('Makers21 A-Frame version initialized successfully!');
});

function setupControlPanel() {
  // Speed control
  const speedControlElement = document.getElementById('speed-control');
  speedControlElement.addEventListener('input', () => {
    speed = speedControlElement.value / 200;
    window.speed = speed;
    document.getElementById('speed-control-text').innerHTML = speedControlElement.value + '% (' + parseFloat(speed).toFixed(2) + ')';
  });
  speedControlElement.addEventListener('change', () => {
    localStorage.setItem("speed", speed);
  });
  speedControlElement.value = speed * 200;
  speedControlElement.dispatchEvent(new Event('input'));

  // H Factor control
  const hFactorControlElement = document.getElementById('hFactor-control');
  hFactorControlElement.addEventListener('input', () => {
    hFactor = hFactorControlElement.value / 200;
    window.hFactor = hFactor;
    document.getElementById('hFactor-control-text').innerHTML = hFactorControlElement.value + '% (' + parseFloat(hFactor).toFixed(2) + ')';
  });
  hFactorControlElement.addEventListener('change', () => {
    localStorage.setItem("hFactor", hFactor);
  });
  hFactorControlElement.value = hFactor * 200;
  hFactorControlElement.dispatchEvent(new Event('input'));

  // V Factor control
  const vFactorControlElement = document.getElementById('vFactor-control');
  vFactorControlElement.addEventListener('input', () => {
    vFactor = vFactorControlElement.value / 200;
    window.vFactor = vFactor;
    document.getElementById('vFactor-control-text').innerHTML = vFactorControlElement.value + '% (' + parseFloat(vFactor).toFixed(2) + ')';
  });
  vFactorControlElement.addEventListener('change', () => {
    localStorage.setItem("vFactor", vFactor);
  });
  vFactorControlElement.value = vFactor * 200;
  vFactorControlElement.dispatchEvent(new Event('input'));

  // Altitude control
  const alttdControlElement = document.getElementById('alttd-control');
  alttdControlElement.addEventListener('input', () => {
    alttd = alttdControlElement.value / 200;
    window.alttd = alttd;
    document.getElementById('alttd-control-text').innerHTML = alttdControlElement.value + '% (' + parseFloat(alttd).toFixed(2) + ')';
  });
  alttdControlElement.addEventListener('change', () => {
    localStorage.setItem("alttd", alttd);
  });
  alttdControlElement.value = alttd * 200;
  alttdControlElement.dispatchEvent(new Event('input'));

  // Level Horizon Rate control
  const levelHrznRateControlElement = document.getElementById('levelHrznRate-control');
  levelHrznRateControlElement.addEventListener('input', () => {
    levelHrznRate = levelHrznRateControlElement.value / 100;
    window.levelHrznRate = levelHrznRate;
    document.getElementById('levelHrznRate-control-text').innerHTML = levelHrznRateControlElement.value + '% (' + parseFloat(levelHrznRate).toFixed(2) + ')';
  });
  levelHrznRateControlElement.addEventListener('change', () => {
    localStorage.setItem("levelHrznRate", levelHrznRate);
  });
  levelHrznRateControlElement.value = levelHrznRate * 100;
  levelHrznRateControlElement.dispatchEvent(new Event('input'));

  // Reset position control
  document.getElementById('reset-control').addEventListener('click', () => {
    if (window.player) {
      window.player.object3D.position.set(0, 1.6, 0);
      window.player.object3D.rotation.x = 0;
      window.player.object3D.rotation.y = 0;
      window.player.object3D.rotation.z = 0;
    }
  });
}