import http from "http";
import express from "express";
import colors from "colors";
import errorHandler from "./middleware/error.middleware.js";
import authRouter from "./routes/auth.routes.js";
import problemsRouter from "./routes/problem.route.js";
import userListsRouter from "./routes/userList.routes.js";
import statsRouter from "./routes/stats.routes.js";
import discussionRouter from "./routes/discussion.routes.js";
import userNoteRouter from "./routes/userNote.routes.js";
import connectDB from "./config/db.js";
import adminRouter from "./routes/admin.routes.js";
import cors from "cors";
import { validateEnv } from "./config/validateEnv.js";
import storage from "./config/storage.js";
import { initSocket } from "./config/socket.js";
import { bootstrapAdmin } from "./services/auth.service.js";

validateEnv();
await connectDB();
await bootstrapAdmin();

// Check if storage is healthy before starting the server
const healthy = await storage.isHealthy();

if (!healthy) {
  console.error("Storage health check failed");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/problems", problemsRouter);
app.use("/api/userlists", userListsRouter);
app.use("/api/stats", statsRouter);
app.use("/api/discussions", discussionRouter);
app.use("/api/notes", userNoteRouter);

app.use(errorHandler);

import "./jobs/workers/submission.worker.js";

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

