import "dotenv/config";
import http from "node:http";
import { app } from "./app.js";
import { initializeDatabase } from "./db/index.js";
import { seedDatabase } from "./db/seed.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

async function bootstrap() {
  try {
    console.log("Initializing MessMate database schema...");
    await initializeDatabase();

    console.log("Checking seed data...");
    await seedDatabase();

    const server = http.createServer(app);

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use. Stop the other process using port ${PORT} and try again.`);
      } else {
        console.error("❌ Server error:", err);
      }
      process.exit(1);
    });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`=================================================`);
      console.log(`🍽️  MessMate API Server Running on port ${PORT}`);
      console.log(`🌐  Open App:     http://localhost:${PORT}`);
      console.log(`🩺  Health check: http://localhost:${PORT}/api/health`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error("Failed to start MessMate backend:", err);
    process.exit(1);
  }
}

bootstrap();
