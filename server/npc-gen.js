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
const TEAM_ATTACK = {
  red: RED_GATE,    // red attacks toward red gate
  blue: BLUE_GATE   // blue attacks toward blue gate
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

// --- NPC state ---
const npcs = []; // { nick, isRed, role, pos, dir, exploding, explodeTimer, orbitAngle, phase }

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

  // Start near home gate with some offset
  const pos = {
    x: home.x + rand(-80, 80),
    y: home.y + rand(-30, 30),
    z: home.z + (isRed ? -1 : 1) * rand(20, 80) // offset toward center from gate
  };

  return {
    nick,
    isRed,
    role,
    pos,
    dir: { x: 0, y: 0, z: isRed ? -1 : 1 }, // face toward opponent gate initially
    exploding: false,
    explodeTimer: null,
    holdingFlag: false,
    // orbit params for defenders
    orbitAngle: rand(0, Math.PI * 2),
    orbitRadius: rand(40, 120),
    orbitSpeed: rand(0.3, 0.8), // radians per second
    orbitYOffset: rand(-30, 30),
    // attack params
    phase: 'outbound', // outbound (toward enemy gate) or 'inbound' (back home)
    attackProgress: rand(0, 1), // 0..1 along the path
    attackSpeed: rand(0.02, 0.05), // progress per second
    // Slight lateral variation for attackers
    lateralOffset: { x: rand(-60, 60), y: rand(-20, 20) }
  };
}

function updateNPC(npc, deltaSec) {
  if (npc.exploding) return;

  if (npc.role === 'defend') {
    updateDefender(npc, deltaSec);
  } else {
    updateAttacker(npc, deltaSec);
  }
}

function updateDefender(npc, deltaSec) {
  // Orbit around own team's gate
  const gate = TEAM_HOME[npc.isRed ? 'red' : 'blue'];

  npc.orbitAngle += npc.orbitSpeed * deltaSec;

  const targetX = gate.x + Math.cos(npc.orbitAngle) * npc.orbitRadius;
  const targetY = gate.y + npc.orbitYOffset + Math.sin(npc.orbitAngle * 0.7) * 15;
  const targetZ = gate.z + Math.sin(npc.orbitAngle) * npc.orbitRadius * (npc.isRed ? -1 : 1);

  // Steer toward target
  steerToward(npc, targetX, targetY, targetZ, deltaSec);
}

function updateAttacker(npc, deltaSec) {
  // Fly between home gate and enemy gate
  const home = TEAM_HOME[npc.isRed ? 'red' : 'blue'];
  const enemy = TEAM_ATTACK[npc.isRed ? 'red' : 'blue'];

  npc.attackProgress += npc.attackSpeed * deltaSec * (npc.phase === 'outbound' ? 1 : -1);

  if (npc.attackProgress >= 1) {
    npc.attackProgress = 1;
    npc.phase = 'inbound';
    // Wait a bit near enemy gate (handled by slow progress)
  } else if (npc.attackProgress <= 0) {
    npc.attackProgress = 0;
    npc.phase = 'outbound';
  }

  // Interpolate between home and enemy with some curve
  const t = npc.attackProgress;
  // Slight arc in Y
  const arcY = Math.sin(t * Math.PI) * 40;

  const targetX = home.x + (enemy.x - home.x) * t + npc.lateralOffset.x * Math.sin(t * Math.PI);
  const targetY = home.y + (enemy.y - home.y) * t + arcY + npc.lateralOffset.y;
  const targetZ = home.z + (enemy.z - home.z) * t;

  steerToward(npc, targetX, targetY, targetZ, deltaSec);
}

function steerToward(npc, targetX, targetY, targetZ, deltaSec) {
  const dx = targetX - npc.pos.x;
  const dy = targetY - npc.pos.y;
  const dz = targetZ - npc.pos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  if (dist < 0.1) return;

  // Target direction
  const targetDir = normalize({ x: dx, y: dy, z: dz });

  // Smooth steering (lerp direction)
  const blend = Math.min(0.1 * deltaSec * 3, 0.5);
  npc.dir.x += (targetDir.x - npc.dir.x) * blend;
  npc.dir.y += (targetDir.y - npc.dir.y) * blend;
  npc.dir.z += (targetDir.z - npc.dir.z) * blend;
  npc.dir = normalize(npc.dir);

  // Move at game speed
  const movePerSec = SPEED * 1000;
  npc.pos.x += npc.dir.x * movePerSec * deltaSec;
  npc.pos.y += npc.dir.y * movePerSec * deltaSec;
  npc.pos.z += npc.dir.z * movePerSec * deltaSec;

  // Clamp to arena bounds
  npc.pos.x = Math.max(-SIZE, Math.min(SIZE, npc.pos.x));
  npc.pos.y = Math.max(5, Math.min(HEIGHT, npc.pos.y));
  npc.pos.z = Math.max(-SIZE, Math.min(SIZE, npc.pos.z));
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
    npc.exploding = false;
    const home = TEAM_HOME[npc.isRed ? 'red' : 'blue'];
    npc.pos = {
      x: home.x + rand(-80, 80),
      y: home.y + rand(-30, 30),
      z: home.z + (npc.isRed ? -1 : 1) * rand(20, 80)
    };
    npc.dir = { x: 0, y: 0, z: npc.isRed ? -1 : 1 };

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

// --- Main ---
async function main() {
  const client = new DeepstreamClient(serverAddr);

  await new Promise((resolve, reject) => {
    client.login(null, (success, _data) => {
      if (success) {
        console.log('Connected to DeepStream');
        resolve();
      } else {
        reject(new Error('Login failed'));
      }
    });
  });

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

  // Listen for manager state to track flag holders
  client.event.subscribe('mngr', (data) => {
    if (data.type === 'state') {
      const state = data.state;
      // Track which NPCs hold flags
      for (const npc of npcs) {
        const flagField = npc.isRed ? 'blueHolder' : 'redHolder';
        const wasHolding = npc.holdingFlag;
        npc.holdingFlag = (state[flagField] === npc.nick);
        if (npc.holdingFlag && !wasHolding) {
          console.log(`${npc.nick} received the flag!`);
        }
      }
    }
  });

  // Position broadcast loop
  const uuid = client.getUid();
  setInterval(() => {
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
