// src/socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

/**
 * Presence store (in-memory)
 * - onlineUsers: userId -> Set<socketId> (multi-tab supported)
 * - lastSeen: userId -> ISO string of last disconnect
 *
 * NOTE: If you scale to multiple Node processes, back this with Redis
 * and use socket.io-redis-adapter so presence is shared across nodes.
 */
const onlineUsers = new Map();
const lastSeen = new Map();

function markOnline(userId, socketId) {
  const key = String(userId);
  if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
  onlineUsers.get(key).add(socketId);
}

function markOffline(userId, socketId) {
  const key = String(userId);
  if (!onlineUsers.has(key)) return;
  const set = onlineUsers.get(key);
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(key);
    lastSeen.set(key, new Date().toISOString());
  }
}

function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

function getOnlineUserIds() {
  // return as numbers when possible
  return Array.from(onlineUsers.keys()).map((k) =>
    Number.isNaN(Number(k)) ? k : Number(k)
  );
}

function getPresenceForIds(ids = []) {
  const result = {};
  ids.forEach((id) => {
    const key = String(id);
    result[key] = {
      online: onlineUsers.has(key),
      last_seen: onlineUsers.has(key) ? null : lastSeen.get(key) || null,
    };
  });
  return result;
}

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://uselessmen.org",
        "https://www.uselessmen.org",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // --- Authenticate socket and join user room ---
    const token =
      socket.handshake?.auth?.token ||
      (socket.handshake?.headers?.authorization || "").replace(
        /^Bearer\s+/i,
        ""
      );

    let authedUserId = null;
    try {
      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload?.id) {
          authedUserId = payload.id;
          socket.data.userId = payload.id;
          socket.join(`user_${payload.id}`);

          // presence: mark online
          markOnline(payload.id, socket.id);

          // broadcast presence update (you can later restrict to friends)
          io.emit("presence:update", {
            userId: payload.id,
            online: true,
            last_seen: null,
          });
        }
      }
    } catch (e) {
      console.warn("Socket auth failed:", e.message);
    }

    // Optional: heartbeats if you want "away" states later
    socket.on("presence:heartbeat", () => {
      // no-op for now; could set last active timestamp, etc.
    });

    // Existing rooms for live chat
    socket.on("joinThread", (threadId) => {
      socket.join(`thread_${threadId}`);
    });

    socket.on("leaveThread", (threadId) => {
      socket.leave(`thread_${threadId}`);
    });

    socket.on("disconnect", () => {
      if (authedUserId != null) {
        markOffline(authedUserId, socket.id);

        if (!isUserOnline(authedUserId)) {
          io.emit("presence:update", {
            userId: authedUserId,
            online: false,
            last_seen: lastSeen.get(String(authedUserId)) || null,
          });
        }
      }
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized! Call initSocket first.");
  return io;
}

module.exports = {
  initSocket,
  getIO,
  // presence helpers used by controllers
  getOnlineUserIds,
  getPresenceForIds,
  isUserOnline,
};
