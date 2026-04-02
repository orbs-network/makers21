# Makers21

**A multiplayer 3D space game that anyone can play — even with just their head.**

Makers21 was built for a friend who became paralyzed in an accident. He can only move his neck and face. We wanted him to be able to play with his friends — not as a spectator, not with a handicap — but as an equal. So we built a capture-the-flag space game controlled entirely by webcam head tracking, running in the browser with zero installation.

If you can move your head, you can fly a spaceship, shoot enemies, capture flags, and compete in real-time multiplayer. No special hardware. No downloads. Just open a link and play.

---

[![Makers21 Demo](https://img.youtube.com/vi/wz4GonJ0T_Y/maxresdefault.jpg)](https://youtu.be/wz4GonJ0T_Y)

---

## Why This Exists

People with quadriplegia, ALS, muscular dystrophy, and other conditions that limit mobility are often excluded from multiplayer gaming — or stuck playing solo-friendly titles while their friends play together. Existing adaptive controllers are expensive and still can't match the speed of standard gamepads.

Makers21 takes a different approach: **the game itself is the adaptive controller.** Head tracking is the native input — not an afterthought or accessibility mode. Every player uses the same controls, so disabled and able-bodied players compete on equal footing.

## Key Highlights

- **Play with your head** — Webcam tracks your face movements to steer, aim, and play. No hands needed.
- **Equal playing field** — Head tracking is the native control for everyone. Disabled and able-bodied players compete with the same skills — no advantage, no handicap.
- **3D multiplayer in the browser** — Real-time team-based capture-the-flag in space. Just share a link.
- **Open source, open for development** — Built to be extended, forked, and improved by the community.

## How It Works

Your webcam feeds into [MediaPipe Face Mesh](https://google.github.io/mediapipe/solutions/face_mesh.html), which tracks 468 facial landmarks in real time. Head tilt and rotation map to ship controls — look left to turn left, look up to climb. The game runs on [Three.js](https://threejs.org/) with a [Deepstream](https://deepstream.io/) server syncing all players in real time.

No data leaves your machine — the video stays local, only control signals are sent to the game.

## Getting Started

### Prerequisites

- Node.js (v14+)
- npm
- A webcam (or use mouse+keyboard fallback)
- Modern browser with WebGL support

### Install and Run

```bash
git clone https://github.com/orbs-network/makers21.git
cd makers21
npm install

# Terminal 1 — start the game server
npm run start-server

# Terminal 2 — start the client (dev mode with hot reload)
npm run dev
```

Opens at `http://localhost:3000`. To connect to a remote server:

```
http://localhost:3000/?server=YOUR_SERVER_IP
```

### Production Build

```bash
npm run build
```

Built files go to `dist/`. Serve with any static server (nginx, etc.).

## Game Controls

| Control | Head Tracking | Keyboard/Mouse |
|---|---|---|
| Steer | Tilt/turn your head | Arrow keys or WASD |
| Look around | Move your head | Mouse |
| Movement | Automatic forward flight | Automatic forward flight |

**Gameplay:** Join Red or Blue team. Fly to the enemy gate, grab their flag, bring it back to yours. Pass flags to teammates. Avoid getting shot.

## Contributing

Makers21 is open source and open for contributions. Some ideas:

- **New game modes** — deathmatch, racing, cooperative missions
- **Input methods** — eye tracking, voice control, single-switch support
- **Accessibility** — screen reader support, audio cues, colorblind modes
- **Gameplay** — new weapons, power-ups, maps, ship models
- **Infrastructure** — matchmaking, lobbies, spectator mode

If you work with people with disabilities and want to try the game, [open an issue](https://github.com/orbs-network/makers21/issues) — we'd love to hear from you.

## Tech Stack

| Component | Technology |
|---|---|
| 3D Engine | Three.js |
| Face Tracking | MediaPipe Face Mesh |
| Multiplayer | Deepstream |
| Build System | Webpack + Babel |

## Who Is This For

- **Players with physical disabilities** — quadriplegia, ALS, muscular dystrophy, or any condition that limits hand use
- **Rehabilitation centers** — a fun, social activity for patients in recovery
- **Disability gaming organizations** — a free, open-source, zero-install game to share with your community
- **Developers** — a starting point for building accessible multiplayer games
- **Anyone** — it's a fun space game, head tracking or not

## The Story Behind Makers21

Makers21 was created by [Orbs](https://www.orbs.com/), a blockchain infrastructure company. When one of our community members had an accident that left him paralyzed, our dev team decided to build something for him — a game he could play with his friends using only his face. This is that game, and we're releasing it to the world so others in similar situations can benefit too.

## License

ISC
