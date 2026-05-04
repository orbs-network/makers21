/**
 * NPCManager — Server-side NPC bots for training mode.
 * Ported from server/npc-gen.js. Spawns defenders and attackers
 * that fly realistic patterns, react to being shot, and accept flag passes.
 * NPCs never shoot or capture flags.
 */

// --- Constants (from npc-gen.js) ---
const SIZE = 500;
const HEIGHT = SIZE * 0.4;
const GATE_Y = HEIGHT / 2 + (SIZE / 60) / 2;
const SPEED = SIZE / 10588;
const UPDATE_INTERVAL = 100;
const EXPLODE_RECOVERY_MS = 5000;
const MAX_TURN_RATE = 0.8; // rad/s

const RED_GATE = { x: 0, y: GATE_Y, z: -SIZE };
const BLUE_GATE = { x: 0, y: GATE_Y, z: SIZE };

const TEAM_HOME = {
  red: BLUE_GATE,
  blue: RED_GATE,
};

// --- Helpers ---
function rand(min, max) {
  return min + Math.random() * (max - min);
}

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 10000) / 10000; }

// --- Names pool ---
const NAMES = [
  'Emma', 'Luca', 'Sofia', 'Marco', 'Elena', 'Matteo', 'Clara', 'Hugo',
  'Astrid', 'Felix', 'Ingrid', 'Lars', 'Freya', 'Klaus', 'Bianca', 'Nico',
  'Elise', 'Sven', 'Mila', 'Yves', 'Greta', 'Daan', 'Lucia', 'Tomas',
  'Nadia', 'Erik', 'Isla', 'Ruben', 'Petra', 'Axel', 'Rosa', 'Kai',
];

let nameIndex = 0;
function nextName() {
  if (nameIndex === 0) {
    for (let i = NAMES.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [NAMES[i], NAMES[j]] = [NAMES[j], NAMES[i]];
    }
  }
  const name = NAMES[nameIndex % NAMES.length];
  nameIndex++;
  return name;
}

// --- NPC creation ---
function createNPC(isRed, role) {
  const nick = nextName();
  const home = TEAM_HOME[isRed ? 'red' : 'blue'];
  const inward = isRed ? -1 : 1;

  const pos = {
    x: rand(-60, 60),
    y: home.y + rand(-20, 20),
    z: home.z + inward * rand(20, 60),
  };

  const base = {
    nick,
    isRed,
    role,
    pos,
    dir: normalize({ x: rand(-0.2, 0.2), y: rand(-0.05, 0.05), z: inward }),
    exploding: false,
    explodeTimer: null,
    holdingFlag: false,
  };

  if (role === 'defend') {
    const centerZ = home.z + inward * 140;
    const R = rand(160, 220);
    const yBase = GATE_Y;
    base.waypoints = [
      { x:  R, y: yBase + rand(5, 25),  z: centerZ },
      { x:  0, y: yBase + rand(-20, -5), z: centerZ - inward * R },
      { x: -R, y: yBase + rand(5, 25),  z: centerZ },
      { x:  0, y: yBase + rand(-20, -5), z: centerZ + inward * R },
    ];
    base.waypointIndex = Math.floor(rand(0, 4));
    base.waypointThreshold = rand(100, 140);
  } else {
    base.ovalCenterZ = 0;
    base.ovalRadiusZ = SIZE * 0.8;
    base.ovalRadiusX = rand(100, 180);
    base.ovalDir = Math.random() < 0.5 ? 1 : -1;
    base.ovalYCenter = GATE_Y + rand(-20, 20);
    base.ovalYAmplitude = rand(15, 30);
  }

  return base;
}

// --- Movement ---
function smoothTurn(npc, desiredDir, deltaSec) {
  const dot = Math.min(1, Math.max(-1,
    npc.dir.x * desiredDir.x + npc.dir.y * desiredDir.y + npc.dir.z * desiredDir.z
  ));
  const angleBetween = Math.acos(dot);
  if (angleBetween < 0.001) return;

  const maxAngle = MAX_TURN_RATE * deltaSec;
  const blend = Math.min(maxAngle / angleBetween, 1.0);

  npc.dir = normalize({
    x: npc.dir.x + (desiredDir.x - npc.dir.x) * blend,
    y: npc.dir.y + (desiredDir.y - npc.dir.y) * blend,
    z: npc.dir.z + (desiredDir.z - npc.dir.z) * blend,
  });
}

function moveForward(npc, deltaSec) {
  const movePerSec = SPEED * 1000;
  npc.pos.x += npc.dir.x * movePerSec * deltaSec;
  npc.pos.y += npc.dir.y * movePerSec * deltaSec;
  npc.pos.z += npc.dir.z * movePerSec * deltaSec;

  npc.pos.x = Math.max(-SIZE * 0.95, Math.min(SIZE * 0.95, npc.pos.x));
  npc.pos.y = Math.max(10, Math.min(HEIGHT - 10, npc.pos.y));
  npc.pos.z = Math.max(-SIZE * 0.95, Math.min(SIZE * 0.95, npc.pos.z));
}

function updateDefender(npc, deltaSec) {
  const wp = npc.waypoints[npc.waypointIndex];
  const dx = wp.x - npc.pos.x;
  const dy = wp.y - npc.pos.y;
  const dz = wp.z - npc.pos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist < npc.waypointThreshold) {
    npc.waypointIndex = (npc.waypointIndex + 1) % npc.waypoints.length;
    return;
  }

  smoothTurn(npc, normalize({ x: dx, y: dy, z: dz }), deltaSec);
}

function updateAttacker(npc, deltaSec) {
  const cx = 0;
  const cz = npc.ovalCenterZ;
  const rx = npc.ovalRadiusX;
  const rz = npc.ovalRadiusZ;

  const dx = npc.pos.x - cx;
  const dz = npc.pos.z - cz;
  const scaledDz = dz * (rx / rz);
  const currentAngle = Math.atan2(scaledDz, dx);

  const tangentX = -Math.sin(currentAngle) * rx * npc.ovalDir;
  const tangentZ = Math.cos(currentAngle) * rz * npc.ovalDir;

  const desiredX = cx + Math.cos(currentAngle) * rx;
  const desiredZ = cz + Math.sin(currentAngle) * rz;
  const errorX = desiredX - npc.pos.x;
  const errorZ = desiredZ - npc.pos.z;
  const corrX = Math.max(-0.3, Math.min(0.3, errorX * 0.008));
  const corrZ = Math.max(-0.3, Math.min(0.3, errorZ * 0.004));

  const desiredY = npc.ovalYCenter + Math.sin(currentAngle * 2) * npc.ovalYAmplitude;
  const yComponent = Math.max(-0.2, Math.min(0.2, (desiredY - npc.pos.y) * 0.012));

  smoothTurn(npc, normalize({
    x: tangentX + corrX,
    y: yComponent,
    z: tangentZ + corrZ,
  }), deltaSec);
}

function updateNPC(npc, deltaSec) {
  if (npc.exploding) return;
  if (npc.role === 'defend') {
    updateDefender(npc, deltaSec);
  } else {
    updateAttacker(npc, deltaSec);
  }
  moveForward(npc, deltaSec);
}

function resetNPCToStart(npc) {
  const home = TEAM_HOME[npc.isRed ? 'red' : 'blue'];
  const hHalf = HEIGHT / 4;
  npc.pos = {
    x: rand(-SIZE * 0.15, SIZE * 0.15),
    y: Math.floor(rand(hHalf, hHalf * 2)),
    z: home.z,
  };
  npc.dir = normalize({
    x: rand(-0.3, 0.3),
    y: rand(-0.1, 0.1),
    z: npc.isRed ? -1 : 1,
  });
  npc.exploding = false;
  npc.holdingFlag = false;
  if (npc.explodeTimer) {
    clearTimeout(npc.explodeTimer);
    npc.explodeTimer = null;
  }
}

// --- NPCManager class ---

class NPCManager {
  constructor(room) {
    this.room = room;
    this.npcs = [];
    this.tickInterval = null;
    this.startTs = 0;
  }

  /**
   * Spawn NPCs for training mode.
   * @param {string} humanTeam - 'A' or 'B' (the human's team)
   * @returns {{ teamA: string[], teamB: string[] }} NPC nicks per team
   */
  spawnForTraining(humanTeam) {
    const humanIsA = humanTeam === 'A';

    // Human's team gets 2 defenders
    // Opponent team gets 2 defenders + 1 attacker
    const allyIsRed = humanIsA; // team A = red in game engine
    const enemyIsRed = !humanIsA;

    // Allies: 2 defenders
    for (let i = 0; i < 2; i++) {
      this.npcs.push(createNPC(allyIsRed, 'defend'));
    }
    // Enemies: 2 defenders + 1 attacker
    for (let i = 0; i < 2; i++) {
      this.npcs.push(createNPC(enemyIsRed, 'defend'));
    }
    this.npcs.push(createNPC(enemyIsRed, 'attack'));

    // Return nicks grouped by team (isRed=true → teamA, isRed=false → teamB)
    const result = { teamA: [], teamB: [] };
    for (const npc of this.npcs) {
      if (npc.isRed) {
        result.teamA.push(npc.nick);
      } else {
        result.teamB.push(npc.nick);
      }
    }

    console.log(`NPCManager: spawned ${this.npcs.length} NPCs`);
    this.npcs.forEach(n => console.log(`  ${n.nick} [${n.isRed ? 'RED' : 'BLUE'}] ${n.role}`));

    return result;
  }

  /**
   * Start the movement tick loop.
   * @param {number} startTs - game start timestamp (after countdown)
   */
  start(startTs) {
    this.startTs = startTs;

    // Reset all NPCs to start positions
    for (const npc of this.npcs) {
      resetNPCToStart(npc);
    }

    this.tickInterval = setInterval(() => {
      if (Date.now() < this.startTs) return;
      const deltaSec = UPDATE_INTERVAL / 1000;

      for (const npc of this.npcs) {
        updateNPC(npc, deltaSec);

        if (!npc.exploding) {
          this.room.broadcast('playerEvent', {
            type: 'pos',
            nick: npc.nick,
            moving: true,
            pos: {
              x: round2(npc.pos.x),
              y: round2(npc.pos.y),
              z: round2(npc.pos.z),
            },
            dir: {
              x: round4(npc.dir.x),
              y: round4(npc.dir.y),
              z: round4(npc.dir.z),
            },
          });
        }
      }
    }, UPDATE_INTERVAL);
  }

  /**
   * Handle a fire event targeting an NPC.
   * @param {string} targetNick
   */
  onFireEvent(targetNick) {
    const npc = this.npcs.find(n => n.nick === targetNick);
    if (!npc || npc.exploding) return;

    npc.exploding = true;
    console.log(`NPC ${npc.nick} exploded!`);

    // Broadcast explosion
    this.room.broadcast('playerEvent', {
      type: 'explode',
      nick: npc.nick,
      flag: true,
      pos: { ...npc.pos },
      dir: { x: 0, y: 0, z: 0 },
    });

    // Drop flag if holding
    if (npc.holdingFlag && this.room.gameEngine) {
      npc.holdingFlag = false;
      this.room.gameEngine.onFlagDrop(npc.nick, npc.isRed);
    }

    // Recover after delay
    npc.explodeTimer = setTimeout(() => {
      npc.exploding = false;
      resetNPCToStart(npc);

      this.room.broadcast('playerEvent', {
        type: 'explode',
        nick: npc.nick,
        flag: false,
        pos: { ...npc.pos },
        dir: { ...npc.dir },
      });

      console.log(`NPC ${npc.nick} recovered`);
    }, EXPLODE_RECOVERY_MS);
  }

  /**
   * Check if a nick belongs to an NPC.
   */
  isNPC(nick) {
    return this.npcs.some(n => n.nick === nick);
  }

  /**
   * Update flag holding state from game engine state.
   */
  syncFlagState(gameState) {
    for (const npc of this.npcs) {
      const flagField = npc.isRed ? 'blueHolder' : 'redHolder';
      npc.holdingFlag = (gameState[flagField] === npc.nick);
    }
  }

  /**
   * Stop all NPC activity and clean up timers.
   */
  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const npc of this.npcs) {
      if (npc.explodeTimer) {
        clearTimeout(npc.explodeTimer);
        npc.explodeTimer = null;
      }
    }
    this.npcs = [];
  }
}

module.exports = NPCManager;
