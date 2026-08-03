import cors from "cors";
import express from "express";
import { cleanupRouter } from "./routes/cleanup.js";
import { sessionsRouter } from "./routes/sessions.js";
import { systemRouter } from "./routes/system.js";
import { tasksRouter } from "./routes/tasks.js";

const PORT = Number(process.env.PORT ?? 58231);

const app = express();
app.use(cors());
app.use(express.json());

app.use("/sessions", sessionsRouter);
app.use("/system", systemRouter);
app.use("/tasks", tasksRouter);
app.use("/cleanup", cleanupRouter);

app.listen(PORT, () => {
  console.log(`Claude Session Manager API listening on http://localhost:${PORT}`);
});
