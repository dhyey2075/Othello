/**
 * In-memory room store. RoomManager only talks to this interface
 * (get / set / delete / has / values), so a Redis-backed store with the same
 * shape (serialising rooms to JSON) can be dropped in later.
 */
export class MemoryRoomStore {
  constructor() {
    this.rooms = new Map();
  }

  get(code) {
    return this.rooms.get(code) ?? null;
  }

  set(code, room) {
    this.rooms.set(code, room);
  }

  delete(code) {
    return this.rooms.delete(code);
  }

  has(code) {
    return this.rooms.has(code);
  }

  values() {
    return [...this.rooms.values()];
  }

  get size() {
    return this.rooms.size;
  }
}
