const mongoose = require('mongoose');

let useMock = false;
const users = [];
const rooms = [];

// Real Mongoose models
const RealUser = require('./User');
const RealRoom = require('./Room');

// Mock User Instance Class
class MockUserInstance {
  constructor(data) {
    this._id = data.id || Math.random().toString(36).substring(2, 9);
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  async save() {
    const idx = users.findIndex(u => u._id === this._id);
    if (idx !== -1) {
      users[idx] = this;
    } else {
      users.push(this);
    }
    return this;
  }
}

const MockUser = {
  findOne: async (query) => {
    let found = null;
    if (query.$or) {
      const [q1, q2] = query.$or;
      found = users.find(u => u.email === q1.email || u.username === q2.username);
    } else if (query.email) {
      found = users.find(u => u.email === query.email);
    } else if (query.username) {
      found = users.find(u => u.username === query.username);
    }
    return found ? found : null;
  },
  findById: async (id) => {
    const found = users.find(u => u._id === id);
    if (!found) return null;
    
    // Support select('-password') chain
    const result = {
      ...found,
      select: function(fields) {
        if (fields.includes('-password')) {
          const { password, ...safeUser } = found;
          return safeUser;
        }
        return found;
      }
    };
    return result;
  },
  create: async (data) => {
    const instance = new MockUserInstance(data);
    await instance.save();
    return instance;
  }
};

// Mock Room Instance Class
class MockRoomInstance {
  constructor(data) {
    this._id = Math.random().toString(36).substring(2, 9);
    this.roomId = data.roomId;
    this.creator = data.creator;
    this.isPrivate = data.isPrivate;
    this.password = data.password;
    this.files = data.files || [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
  async save() {
    const idx = rooms.findIndex(r => r.roomId === this.roomId);
    if (idx !== -1) {
      rooms[idx] = this;
    } else {
      rooms.push(this);
    }
    return this;
  }
}

const MockRoom = {
  findOne: (query) => {
    const room = rooms.find(r => r.roomId === query.roomId);
    
    // Support chainable populate
    const populateObj = {
      populate: function(path, select) {
        if (room && path === 'creator') {
          const userObj = users.find(u => u._id.toString() === room.creator?.toString());
          return {
            ...room,
            creator: userObj ? { username: userObj.username } : null
          };
        }
        return room;
      }
    };
    
    // Allow direct await or chaining populate
    const promise = Promise.resolve(room);
    return Object.assign(promise, populateObj);
  },
  findOneAndUpdate: async (query, update) => {
    const room = rooms.find(r => r.roomId === query.roomId);
    if (!room) return null;

    if (update.$set) {
      const setKeys = Object.keys(update.$set);
      setKeys.forEach(key => {
        if (key.startsWith('files.$.')) {
          const field = key.replace('files.$.', '');
          const fileName = query['files.name'];
          const file = room.files.find(f => f.name === fileName);
          if (file) {
            file[field] = update.$set[key];
          }
        } else {
          room[key] = update.$set[key];
        }
      });
    } else {
      Object.assign(room, update);
    }
    room.updatedAt = new Date();
    return room;
  },
  create: async (data) => {
    const instance = new MockRoomInstance(data);
    await instance.save();
    return instance;
  }
};

module.exports = {
  get User() {
    return useMock ? MockUser : RealUser;
  },
  get Room() {
    return useMock ? MockRoom : RealRoom;
  },
  setUseMock: (val) => {
    useMock = val;
    console.log(`[Database Wrapper] Mode switched to: ${val ? 'IN-MEMORY MOCK' : 'MONGODB MONGOOSE'}`);
  },
  // Instances wrapper to support new keyword
  NewUser: function(data) {
    if (useMock) {
      return new MockUserInstance(data);
    } else {
      return new RealUser(data);
    }
  },
  NewRoom: function(data) {
    if (useMock) {
      return new MockRoomInstance(data);
    } else {
      return new RealRoom(data);
    }
  }
};
