const Room = require('./Room');
const config = require('../config');

class RoomManager {
  constructor(mediasoupManager) {
    this.rooms = new Map(); // roomId -> Room
    this.mediasoupManager = mediasoupManager;

    // periodic cleanup of empty rooms
    this.cleanupTimer = setInterval(() => this.cleanup(), config.roomCleanupInterval);
  }

  createRoom(name, hostNick) {
    const room = new Room(name, hostNick, this.mediasoupManager);
    this.rooms.set(room.id, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.dispose();
    this.rooms.delete(roomId);
    return true;
  }

  listRooms() {
    return Array.from(this.rooms.values()).map(r => r.toListJSON());
  }

  /**
   * Find all rooms (excluding the optional skipRoomId) that have this nick.
   */
  findRoomsByNick(nick, skipRoomId = null) {
    const matches = [];
    for (const [, room] of this.rooms) {
      if (room.id === skipRoomId) continue;
      if (room.players.has(nick)) matches.push(room);
    }
    return matches;
  }

  cleanup() {
    const now = Date.now();
    for (const [id, room] of this.rooms) {
      if (room.players.size === 0 && now - room.lastActivity > config.roomEmptyTimeout) {
        this.rooms.delete(id);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupTimer);
  }
}

module.exports = RoomManager;
