// src/socket.js
const { Server } = require("socket.io");

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

    // Join conversation room
    socket.on("joinThread", (threadId) => {
      socket.join(`thread_${threadId}`);
      console.log(`📥 Socket ${socket.id} joined thread_${threadId}`);
    });

    // Leave conversation room
    socket.on("leaveThread", (threadId) => {
      socket.leave(`thread_${threadId}`);
      console.log(`📤 Socket ${socket.id} left thread_${threadId}`);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized! Call initSocket first.");
  }
  return io;
}

module.exports = { initSocket, getIO };
