import { io } from "socket.io-client";

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/api\/?$/, "");
};

export const socket = io(getSocketUrl(), {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("[Socket.io Client] Connected with ID:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("[Socket.io Client] Disconnected:", reason);
});

socket.on("connect_error", (error) => {
  console.error("[Socket.io Client] Connection error:", error);
});

export default socket;
