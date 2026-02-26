# Makers21

A multiplayer 3D spaceship game built with Three.js featuring head/face tracking controls via webcam.

## Overview

Makers21 is a "Capture the Flag" style game where two teams (Red and Blue) pilot spacecraft, competing to capture the enemy's flag and return it to their own gate to score. The game supports real-time multiplayer through Deepstream and offers an innovative control scheme using webcam-based head tracking.

## Features

- Real-time multiplayer (2+ players)
- Head/face tracking controls via webcam (MediaPipe Face Mesh)
- Team-based gameplay (Red vs Blue)
- Capture-the-flag game mode
- 3D particle explosion effects
- Positional audio system
- Post-processing effects (bloom, motion trails)
- Mobile-optimized A-Frame version for VR/WebXR
- Keyboard fallback controls

## Tech Stack

- **Three.js** - 3D rendering and scene management
- **MediaPipe Face Mesh** - Webcam-based head tracking
- **Deepstream** - Real-time multiplayer synchronization
- **Webpack/Babel** - Build system
- **A-Frame** - Alternative VR version

## Project Structure

```
makers21/
├── src/
│   ├── components/          # Game components
│   │   ├── game.js          # Main game orchestrator
│   │   ├── world.js         # 3D scene setup
│   │   ├── face.js          # Face detection (MediaPipe)
│   │   ├── neckControls.js  # Head tracking camera controls
│   │   ├── players.js       # Player management
│   │   ├── shooting.js      # Targeting mechanics
│   │   ├── flag.js          # Flag capture logic
│   │   ├── deepstream.js    # Network layer
│   │   ├── explode.js       # Particle effects
│   │   └── sound.js         # 3D audio system
│   ├── aframe-version/      # A-Frame VR implementation
│   ├── assets/              # Models, textures, audio
│   ├── index.js             # Main entry point
│   └── index.html           # Game HTML
├── server/
│   ├── index.js             # Deepstream server
│   ├── game-manager.js      # Game state management
│   └── config/              # Server configuration
├── dist/                    # Build output
├── webpack.config.js        # Webpack configuration
└── package.json
```

## Prerequisites

- Node.js (v14 or higher recommended)
- npm
- A webcam (for head tracking controls)
- Modern browser with WebGL support

## Installation

```bash
# Clone the repository
git clone https://github.com/uv-orbs/makers21.git
cd makers21

# Install dependencies
npm install
```

## Running the Server

The game server uses Deepstream for real-time multiplayer synchronization.

```bash
# Start the Deepstream server
npm run start-server
```

This runs the server with the configuration from `./server/config/config.yaml`.

The server handles:
- Player connections and team assignments
- Game state management (start, reset, scoring)
- Flag capture and pass events
- Broadcasting player positions to all clients

## Running the Client

### Development Mode

```bash
# Start the webpack dev server with hot reload
npx webpack serve --mode=development
```

This starts a development server at `http://localhost:3000` with hot module replacement.

### Production Build

```bash
# Build for production
npx webpack --mode=production
```

The built files will be in the `dist/` directory:
- `dist/index.html` - Three.js version
- `dist/aframe.html` - A-Frame VR version

You can serve these files with any static file server:

```bash
# Using a simple HTTP server
npx http-server dist
# or
npx live-server dist
```

## Game Controls

### Head Tracking (Default)
- Move your head to control the ship's direction
- The ship moves forward automatically
- Look left/right to turn
- Look up/down to change altitude

### Keyboard (Fallback)
- Arrow keys or WASD for movement
- Mouse for looking around

## Gameplay

1. **Join a Team** - Select Red or Blue team
2. **Navigate** - Use head tracking or keyboard to pilot your ship
3. **Capture the Flag** - Fly to the enemy gate and grab their flag
4. **Return to Score** - Bring the flag back to your own gate
5. **Pass the Flag** - Transfer the flag to nearby teammates
6. **Avoid Getting Hit** - Enemy targeting and boundary collisions cause explosions

## Configuration

Game constants can be adjusted in `src/components/config.js`:
- `SIZE` - Game area dimensions
- `distancePerMS` - Movement speed
- `targetLockMs` - Time to lock onto a target
- `shootingRange` - Maximum targeting distance

## License

ISC
