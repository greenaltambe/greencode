import { Server } from "socket.io";
import { subscriber, SUBMISSION_CHANNEL } from "../jobs/redis.js";

let io = null;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Subscribe to Redis updates
  subscriber.subscribe(SUBMISSION_CHANNEL, (err, count) => {
    if (err) {
      console.error("[Socket.io] Failed to subscribe to Redis channel:", err);
    } else {
      console.log(`[Socket.io] Subscribed to Redis channel: ${SUBMISSION_CHANNEL}`);
    }
  });

  subscriber.on("message", (channel, message) => {
    if (channel === SUBMISSION_CHANNEL) {
      try {
        const data = JSON.parse(message);
        if (data && data.submissionId) {
          // Broadcast to clients in submission room
          io.to(`submission:${data.submissionId}`).emit("submission_update", data);
        }
      } catch (err) {
        console.error("[Socket.io] Failed to parse Redis message:", err);
      }
    }
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    socket.on("join_submission", (submissionId) => {
      if (submissionId) {
        const roomName = `submission:${submissionId}`;
        socket.join(roomName);
        console.log(`[Socket.io] Socket ${socket.id} joined room ${roomName}`);
      }
    });

    socket.on("leave_submission", (submissionId) => {
      if (submissionId) {
        const roomName = `submission:${submissionId}`;
        socket.leave(roomName);
        console.log(`[Socket.io] Socket ${socket.id} left room ${roomName}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io has not been initialized!");
  }
  return io;
};
