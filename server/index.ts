import cors from "cors";
import express from "express";
import { cleanupRouter } from "./routes/cleanup.js";
import { sessionsRouter } from "./routes/sessions.js";
import { systemRouter } from "./routes/system.js";
import { tasksRouter } from "./routes/tasks.js";
import { autoUpdateSkillsHubOnStart } from "./services/skillsHubService.js";
import { startTaskScheduler } from "./services/taskSchedulerService.js";
import { API_PORT } from "./utils/apiPort.js";
import { errorHandler } from "./utils/httpError.js";
import { migrateLegacySidecars } from "./utils/taskStore.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/sessions", sessionsRouter);
app.use("/system", systemRouter);
app.use("/tasks", tasksRouter);
app.use("/cleanup", cleanupRouter);
app.use(errorHandler);

app.listen(API_PORT, () => {
  console.log(`Claude Session Manager API listening on http://localhost:${API_PORT}`);
  // Background, after the server is already answering.
  void autoUpdateSkillsHubOnStart();
  startTaskScheduler();
  // Also runs lazily on the first read/write, so a request arriving first can't miss it.
  migrateLegacySidecars()
    .then(({ migrated, sessions, branches }) => {
      if (migrated) {
        console.log(`[tasks.json] Migrated ${sessions} session(s) and ${branches} branch base(s).`);
      }
    })
    .catch((err: unknown) => console.warn("[tasks.json] Migration failed:", err));
});
