/**
 * NPC Generator for Makers21
 *
 * Creates NPC players on both teams for video demos.
 * NPCs fly realistic patterns, respond to being shot, and accept flag passes.
 * They do NOT shoot or capture flags.
 *
 * Usage: node server/npc-gen.js num=3 serverHost=localhost:6020
 *   num: number of NPCs per team (red gets num, blue gets num-1). Default: 1
 *   serverHost: deepstream server address. Default: localhost:6020
 */

const { DeepstreamClient } = require('@deepstream/client');

// --- Config ---
const SIZE = 500;
const HEIGHT = SIZE * 0.4; // 200
const GATE_Y = HEIGHT / 2 + (SIZE / 60) / 2; // ~104
const SPEED = SIZE / 10588; // units per ms, matches client
const UPDATE_INTERVAL = 100; // ms
const EXPLODE_RECOVERY_MS = 5000;

// Gate positions
const RED_GATE = { x: 0, y: GATE_Y, z: -SIZE };   // z = -500
const BLUE_GATE = { x: 0, y: GATE_Y, z: SIZE };    // z = +500

// Team home gates (where they start / defend)
// Red team starts near blue gate, blue team starts near red gate
const TEAM_HOME = {
  red: BLUE_GATE,   // red defends blue gate area
  blue: RED_GATE    // blue defends red gate area
};

// --- Parse args ---
// Usage: node npc-gen.js num=3 serverHost=localhost:6020
const args = {};
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf('=');
  if (eq > 0) {
    args[arg.slice(0, eq)] = arg.slice(eq + 1);
  }
}

const MAX_TEAM_SIZE = 6;
const npcNum = parseInt(args.num) || 1;
const serverAddr = args.serverHost || 'localhost:6020';

if (npcNum < 1) {
  console.error('npcNum must be >= 1');
  process.exit(1);
}
if (npcNum > MAX_TEAM_SIZE) {
  console.error(`npcNum must be <= ${MAX_TEAM_SIZE} (max team size)`);
  process.exit(1);
}

console.log(`NPC Generator: ${npcNum} red, ${npcNum - 1} blue, server: ${serverAddr}`);

// --- Game & NPC state ---
const npcs = []; // { nick, isRed, role, pos, dir, exploding, explodeTimer, orbitAngle, phase }
let gameStarted = false;
let gameStartTs = 0; // timestamp when game actually begins (after countdown)
let gameOver = false;

// --- Helpers ---
function rand(min, max) {
  return min + Math.random() * (max - min);
}

function normalize(v) {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 1 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function round4(v) {
  return Math.round(v * 10000) / 10000;
}

// --- Names pool (mixed European boys & girls) ---
const NAMES = [
  'Emma', 'Luca', 'Sofia', 'Marco', 'Elena', 'Matteo', 'Clara', 'Hugo',
  'Astrid', 'Felix', 'Ingrid', 'Lars', 'Freya', 'Klaus', 'Bianca', 'Nico',
  'Elise', 'Sven', 'Mila', 'Yves', 'Greta', 'Daan', 'Lucia', 'Tomas',
  'Nadia', 'Erik', 'Isla', 'Ruben', 'Petra', 'Axel', 'Rosa', 'Kai',
];

let nameIndex = 0;
function nextName() {
  // Shuffle on first pass through
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

// --- NPC behavior ---

function createNPCs() {
  const redCount = npcNum;
  const blueCount = Math.max(0, npcNum - 1);

  // Divide into defenders and attackers
  // If only 1 per team, make them all defenders
  // If > 1, half defend, half attack
  function assignRoles(count, isRed) {
    const results = [];
    if (count === 0) return results;
    if (count === 1) {
      results.push(createNPC(isRed, 'defend', 0));
    } else {
      const defenderCount = Math.ceil(count / 2);
      for (let i = 0; i < count; i++) {
        const role = i < defenderCount ? 'defend' : 'attack';
        results.push(createNPC(isRed, role, i));
      }
    }
    return results;
  }

  npcs.push(...assignRoles(redCount, true));
  npcs.push(...assignRoles(blueCount, false));
}

function createNPC(isRed, role) {
  const nick = nextName();
  const home = TEAM_HOME[isRed ? 'red' : 'blue'];
  const inward = isRed ? -1 : 1; // direction toward arena center from home gate

  // Start near home gate
  const pos = {
    x: rand(-60, 60),
    y: home.y + rand(-20, 20),
    z: home.z + inward * rand(20, 60)
  };

  const base = {
    nick,
    isRed,
    role,
    pos,
    dir: normalize({ x: rand(-0.2, 0.2), y: rand(-0.05, 0.05), z: inward }),
    exploding: false,
    explodeTimer: null,
    holdingFlag: false
  };

  if (role === 'defend') {
    // 4 waypoints in a diamond around the gate, fly point-to-point clockwise
    const centerZ = home.z + inward * 140; // offset toward arena center
    const R = rand(160, 220); // diamond radius — large enough for smooth turns
    const yBase = GATE_Y;
    base.waypoints = [
      { x:  R, y: yBase + rand(5, 25),  z: centerZ },          // right
      { x:  0, y: yBase + rand(-20, -5), z: centerZ - inward * R }, // toward gate
      { x: -R, y: yBase + rand(5, 25),  z: centerZ },          // left
      { x:  0, y: yBase + rand(-20, -5), z: centerZ + inward * R }, // away from gate
    ];
    base.waypointIndex = Math.floor(rand(0, 4)); // start at random point
    base.waypointThreshold = rand(100, 140); // start turning well before reaching waypoint
  } else {
    // Elliptical oval between gates — always curving, never a 180
    base.ovalCenterZ = 0; // midpoint of arena
    base.ovalRadiusZ = SIZE * 0.8; // 400 units along Z (won't quite reach gates)
    base.ovalRadiusX = rand(100, 180); // width of the oval
    base.ovalDir = Math.random() < 0.5 ? 1 : -1; // CW or CCW
    base.ovalYCenter = GATE_Y + rand(-20, 20);
    base.ovalYAmplitude = rand(15, 30);
  }

  return base;
}

// --- Movement system ---
// Core idea: compute desired direction from the NPC's ACTUAL position on its
// flight pattern (tangent to orbit/oval), then smoothly turn toward it.
// No target-point chasing. No turn budgets. Always smooth.

const MAX_TURN_RATE = 0.8; // rad/s — realistic head-tracking turn rate

function smoothTurn(npc, desiredDir, deltaSec) {
  const dot = Math.min(1, Math.max(-1,
    npc.dir.x * desiredDir.x + npc.dir.y * desiredDir.y + npc.dir.z * desiredDir.z
  ));
  const angleBetween = Math.acos(dot);
  if (angleBetween < 0.001) return; // already aligned

  const maxAngle = MAX_TURN_RATE * deltaSec;
  const blend = Math.min(maxAngle / angleBetween, 1.0);

  npc.dir = normalize({
    x: npc.dir.x + (desiredDir.x - npc.dir.x) * blend,
    y: npc.dir.y + (desiredDir.y - npc.dir.y) * blend,
    z: npc.dir.z + (desiredDir.z - npc.dir.z) * blend
  });
}

function moveForward(npc, deltaSec) {
  const movePerSec = SPEED * 1000;
  npc.pos.x += npc.dir.x * movePerSec * deltaSec;
  npc.pos.y += npc.dir.y * movePerSec * deltaSec;
  npc.pos.z += npc.dir.z * movePerSec * deltaSec;

  // Safety clamp (orbit math keeps them in bounds normally)
  npc.pos.x = Math.max(-SIZE * 0.95, Math.min(SIZE * 0.95, npc.pos.x));
  npc.pos.y = Math.max(10, Math.min(HEIGHT - 10, npc.pos.y));
  npc.pos.z = Math.max(-SIZE * 0.95, Math.min(SIZE * 0.95, npc.pos.z));
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

// --- Defender: fly between 4 waypoints in a diamond around the gate ---
function updateDefender(npc, deltaSec) {
  const wp = npc.waypoints[npc.waypointIndex];

  // Direction toward current waypoint
  const dx = wp.x - npc.pos.x;
  const dy = wp.y - npc.pos.y;
  const dz = wp.z - npc.pos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Close enough? Advance to next waypoint
  if (dist < npc.waypointThreshold) {
    npc.waypointIndex = (npc.waypointIndex + 1) % npc.waypoints.length;
    return; // will pick up new waypoint next tick
  }

  const desiredDir = normalize({ x: dx, y: dy, z: dz });
  smoothTurn(npc, desiredDir, deltaSec);
}

// --- Attacker: elliptical oval between gates using tangent direction ---
function updateAttacker(npc, deltaSec) {
  const cx = 0;
  const cz = npc.ovalCenterZ; // 0 = arena center
  const rx = npc.ovalRadiusX;
  const rz = npc.ovalRadiusZ;

  // Map position to a "circular" angle by scaling the ellipse axes
  const dx = npc.pos.x - cx;
  const dz = npc.pos.z - cz;
  // Scale Z by rx/rz so the ellipse maps to a circle for angle computation
  const scaledDz = dz * (rx / rz);
  const currentAngle = Math.atan2(scaledDz, dx);

  // Tangent direction on the ellipse:
  // Ellipse: (rx*cos(a), rz*sin(a)), tangent: (-rx*sin(a), rz*cos(a))
  const tangentX = -Math.sin(currentAngle) * rx * npc.ovalDir;
  const tangentZ = Math.cos(currentAngle) * rz * npc.ovalDir;

  // Radial correction — pull back toward the ellipse surface
  const desiredX = cx + Math.cos(currentAngle) * rx;
  const desiredZ = cz + Math.sin(currentAngle) * rz;
  const errorX = desiredX - npc.pos.x;
  const errorZ = desiredZ - npc.pos.z;
  const corrX = Math.max(-0.3, Math.min(0.3, errorX * 0.008));
  const corrZ = Math.max(-0.3, Math.min(0.3, errorZ * 0.004));

  // Vertical arc — peak in the middle of each leg
  const desiredY = npc.ovalYCenter + Math.sin(currentAngle * 2) * npc.ovalYAmplitude;
  const yComponent = Math.max(-0.2, Math.min(0.2, (desiredY - npc.pos.y) * 0.012));

  const desiredDir = normalize({
    x: tangentX + corrX,
    y: yComponent,
    z: tangentZ + corrZ
  });

  smoothTurn(npc, desiredDir, deltaSec);
}

// --- Explosion handling ---
function explodeNPC(npc, client) {
  if (npc.exploding) return;
  npc.exploding = true;

  console.log(`${npc.nick} exploded!`);

  // Broadcast explosion start
  client.event.emit('player', {
    type: 'explode',
    flag: true,
    pos: { ...npc.pos },
    dir: { x: 0, y: 0, z: 0 },
    nick: npc.nick
  });

  // Drop flag if holding
  if (npc.holdingFlag) {
    npc.holdingFlag = false;
    client.rpc.make('client', {
      type: 'flagDrop',
      nick: npc.nick,
      isRed: npc.isRed
    }, (err, result) => {
      if (err) console.log(`flagDrop error for ${npc.nick}:`, err);
      else console.log(`${npc.nick} dropped flag:`, result);
    });
  }

  // Recover after delay — return to start position
  npc.explodeTimer = setTimeout(() => {
    if (gameOver) return; // don't recover after game ends
    npc.exploding = false;
    resetNPCToStart(npc);

    // Broadcast recovery
    client.event.emit('player', {
      type: 'explode',
      flag: false,
      pos: { ...npc.pos },
      dir: { ...npc.dir },
      nick: npc.nick
    });

    console.log(`${npc.nick} recovered`);
  }, EXPLODE_RECOVERY_MS);
}

// --- Game lifecycle helpers ---
function resetNPCToStart(npc) {
  const home = TEAM_HOME[npc.isRed ? 'red' : 'blue'];
  // Spread NPCs along the start line like real players do
  const hHalf = HEIGHT / 4;
  npc.pos = {
    x: rand(-SIZE * 0.15, SIZE * 0.15),
    y: Math.floor(rand(hHalf, hHalf * 2)),
    z: home.z
  };
  npc.dir = normalize({
    x: rand(-0.3, 0.3),
    y: rand(-0.1, 0.1),
    z: npc.isRed ? -1 : 1
  });
  npc.exploding = false;
  npc.holdingFlag = false;
  if (npc.explodeTimer) {
    clearTimeout(npc.explodeTimer);
    npc.explodeTimer = null;
  }
}

async function rejoinAll(client) {
  for (const npc of npcs) {
    resetNPCToStart(npc);
    client.rpc.make('client', {
      type: 'join',
      nick: npc.nick,
      isRed: npc.isRed
    }, (err, result) => {
      if (err) console.error(`Re-join failed for ${npc.nick}:`, err);
      else console.log(`${npc.nick} re-joined: ${result}`);
    });
  }
}

// --- Main ---
async function main() {
  const client = new DeepstreamClient(serverAddr);
  await client.login();
  console.log('Connected to DeepStream');

  // Create NPC definitions
  createNPCs();
  console.log(`Created ${npcs.length} NPCs:`);
  npcs.forEach(n => console.log(`  ${n.nick} [${n.isRed ? 'RED' : 'BLUE'}] ${n.role}`));

  // Join all NPCs to teams via RPC
  for (const npc of npcs) {
    await new Promise((resolve, reject) => {
      client.rpc.make('client', {
        type: 'join',
        nick: npc.nick,
        isRed: npc.isRed
      }, (err, result) => {
        if (err) {
          console.error(`Failed to join ${npc.nick}:`, err);
          reject(err);
        } else {
          console.log(`${npc.nick} joined: ${result}`);
          resolve();
        }
      });
    });
  }

  // Listen for fire events targeting our NPCs
  client.event.subscribe('player', (data) => {
    if (data.type === 'fire') {
      const targetNpc = npcs.find(n => n.nick === data.targetNick);
      if (targetNpc) {
        explodeNPC(targetNpc, client);
      }
    }
  });

  // Listen for manager state — track game lifecycle and flag holders
  client.event.subscribe('mngr', (data) => {
    if (data.type !== 'state') return;
    const state = data.state;

    // --- Game start ---
    if (state.started && !gameStarted) {
      gameStarted = true;
      gameOver = false;
      gameStartTs = state.startTs || Date.now();
      console.log(`Game started! Flying begins at ${new Date(gameStartTs).toISOString()}`);
      // Reset NPC positions to start lines
      for (const npc of npcs) {
        resetNPCToStart(npc);
      }
    }

    // --- Game over (winner declared) ---
    if (state.winnerNick && !gameOver) {
      gameOver = true;
      console.log(`Game over! Winner: ${state.winnerNick} (${state.winnerIsRed ? 'RED' : 'BLUE'})`);
    }

    // --- Game reset ---
    if (state.needReset) {
      gameStarted = false;
      gameOver = false;
      gameStartTs = 0;
      console.log('Game reset. Waiting for next game...');
      // Re-join NPCs (reset clears rosters)
      rejoinAll(client);
    }

    // --- Track flag holders ---
    for (const npc of npcs) {
      const flagField = npc.isRed ? 'blueHolder' : 'redHolder';
      const wasHolding = npc.holdingFlag;
      npc.holdingFlag = (state[flagField] === npc.nick);
      if (npc.holdingFlag && !wasHolding) {
        console.log(`${npc.nick} received the flag!`);
      }
    }
  });

  // Position broadcast loop — only fly when game is active
  const uuid = client.getUid();
  setInterval(() => {
    // Don't move before game starts or after game over
    if (!gameStarted || gameOver) return;
    // Respect the countdown — don't move until startTs
    if (Date.now() < gameStartTs) return;

    const deltaSec = UPDATE_INTERVAL / 1000;

    for (const npc of npcs) {
      updateNPC(npc, deltaSec);

      if (!npc.exploding) {
        client.event.emit('player', {
          type: 'pos',
          id: uuid,
          nick: npc.nick,
          moving: true,
          pos: {
            x: round2(npc.pos.x),
            y: round2(npc.pos.y),
            z: round2(npc.pos.z)
          },
          dir: {
            x: round4(npc.dir.x),
            y: round4(npc.dir.y),
            z: round4(npc.dir.z)
          }
        });
      }
    }
  }, UPDATE_INTERVAL);

  console.log('\nNPC Generator running. Press Ctrl+C to stop.');
  console.log('Waiting for game to start...\n');

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down NPCs...');
    // Leave all NPCs
    let pending = npcs.length;
    if (pending === 0) process.exit(0);

    for (const npc of npcs) {
      if (npc.explodeTimer) clearTimeout(npc.explodeTimer);
      client.rpc.make('client', {
        type: 'leave',
        nick: npc.nick,
        isRed: npc.isRed
      }, () => {
        pending--;
        if (pending === 0) {
          console.log('All NPCs left. Bye!');
          process.exit(0);
        }
      });
    }
    // Force exit after 3 sec
    setTimeout(() => process.exit(0), 3000);
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
