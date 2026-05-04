const express = require('express');

function createRoomRoutes(roomManager) {
  const router = express.Router();

  // List all rooms
  router.get('/', (req, res) => {
    res.json(roomManager.listRooms());
  });

  // Create a room
  router.post('/', (req, res) => {
    const { name, hostNick } = req.body;
    if (!name || !hostNick) {
      return res.status(400).json({ error: 'name and hostNick are required' });
    }
    const result = roomManager.createRoom(name, hostNick);
    if (result.error) {
      return res.status(503).json({ error: result.error });
    }
    res.status(201).json({
      roomId: result.room.id,
      inviteLink: `${req.protocol}://${req.get('host')}?room=${result.room.id}`,
    });
  });

  // Get room detail
  router.get('/:roomId', (req, res) => {
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room.toJSON());
  });

  // Delete a room (host only)
  router.delete('/:roomId', (req, res) => {
    const { hostNick } = req.body;
    const room = roomManager.getRoom(req.params.roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.hostNick !== hostNick) {
      return res.status(403).json({ error: 'Only the host can delete the room' });
    }
    roomManager.deleteRoom(req.params.roomId);
    res.json({ ok: true });
  });

  return router;
}

module.exports = createRoomRoutes;
