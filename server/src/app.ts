import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { authRouter } from "./routes/authRoutes.js";
import { studentRouter } from "./routes/studentRoutes.js";
import { scannerRouter } from "./routes/scannerRoutes.js";
import { adminRouter } from "./routes/adminRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests with no origin (curl, mobile, same-origin) or any local dev / Go Live origin
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "MessMate Digital Mess Management Platform",
    timestamp: new Date().toISOString(),
  });
});

// Portals and API routes
app.use("/api/auth", authRouter);
app.use("/api/student", studentRouter);
app.use("/api/scanner", scannerRouter);
app.use("/api/admin", adminRouter);

// Serve built frontend static files if client/dist exists (allows single-port & Go Live fallback)
const clientDistDir = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(clientDistDir)) {
  app.use(express.static(clientDistDir));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(clientDistDir, "index.html"));
  });
}

// Global Error Handler
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Unhandled error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal server error occurred",
    });
  }
);
