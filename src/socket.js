// src/socket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

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
    console.log("🟢 New client connected:", socket.id);

    // --- Authenticate socket and join user room ---
    const token =
      socket.handshake?.auth?.token ||
      (socket.handshake?.headers?.authorization || "").replace(
        /^Bearer\s+/i,
        ""
      );

    try {
      if (token) {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        if (payload?.id) {
          socket.data.userId = payload.id;
          socket.join(`user_${payload.id}`);
          console.log(`👤 Socket ${socket.id} joined user_${payload.id}`);
        }
      }
    } catch (e) {
      console.warn("⚠️ Socket auth failed:", e.message);
    }

    // Join/leave conversation rooms (for live chat view)
    socket.on("joinThread", (threadId) => {
      socket.join(`thread_${threadId}`);
      console.log(`📥 ${socket.id} joined thread_${threadId}`);
    });

    socket.on("leaveThread", (threadId) => {
      socket.leave(`thread_${threadId}`);
      console.log(`📤 ${socket.id} left thread_${threadId}`);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized! Call initSocket first.");
  return io;
}

module.exports = { initSocket, getIO };
