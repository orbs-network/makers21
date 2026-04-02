# NPC Generator

Spawns AI-controlled players into a Makers21 game for demo videos and testing. NPCs fly realistic patterns, react when shot, and accept flag passes — but they never shoot or capture flags themselves.

## Usage

```bash
# Start the game server first
npm run start-server

# Then run the NPC generator
node server/npc-gen.js num=3 serverHost=localhost:6020
```

### Parameters

| Param | Default | Description |
|-------|---------|-------------|
| `num` | `1` | NPCs per team. Red gets `num`, blue gets `num - 1` (you play on blue) |
| `serverHost` | `localhost:6020` | DeepStream server address |

### Examples

```bash
# 1 red defender, 0 blue (solo target practice)
node server/npc-gen.js num=1

# 3 red, 2 blue — mix of defenders and attackers
node server/npc-gen.js num=3

# Connect to remote server
node server/npc-gen.js num=4 serverHost=ws-makers.orbs.com:6021
```

## How it works

1. Connects to the DeepStream server as a headless client
2. Joins NPCs to teams with randomized European first names (Emma, Luca, Freya, Marco, etc.)
3. Once running, broadcasts position updates every 100ms at game speed

### NPC behaviors

When `num` is 1, the NPC is a **defender**. When `num` > 1, each team's NPCs split into two roles:

- **Defenders** (half) — orbit around their team's home gate at varying radii, speeds, and heights
- **Attackers** (half) — fly back and forth between home and enemy gate in arcing paths, creating visible action near both gates

### Interactions

| Action | NPC response |
|--------|-------------|
| You shoot an NPC | Explodes, drops flag if holding, recovers after 5s |
| You pass flag to teammate NPC | Accepts it (server handles the RPC) |
| NPC holding flag gets shot | Auto-drops the flag |
| NPCs shoot at you? | **No** — they never fire |
| NPCs capture flags? | **No** — they never enter gates |

## Stopping

Press `Ctrl+C` — all NPCs leave the game cleanly before the process exits.
