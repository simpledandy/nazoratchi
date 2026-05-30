import express from "express";
import apiRouter from "../server/api.js";
import { bot } from "../server/bot.js";

const app = express();
app.use(express.json());

// Enable CORS for client-side requests
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

// Set up the Telegram webhook receiver
app.post("/api/telegram-webhook", async (req, res) => {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  
  // Validate the secret token to verify that the request comes from Telegram
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("Unauthorized webhook call detected - invalid secret token");
    return res.status(403).send("Unauthorized");
  }

  if (!bot) {
    console.warn("Webhook request received but Bot is not initialized (TELEGRAM_BOT_TOKEN is missing).");
    return res.status(503).send("Bot is not configured");
  }

  try {
    // Process incoming updates directly
    await bot.handleUpdate(req.body, res);
  } catch (err: any) {
    console.error("Error handling webhook update:", err);
    res.status(500).send("Error processing update");
  }
});

// Mount the standard API endpoints
app.use("/api", apiRouter);

// Forward other sub-routing directly to our api router for safety
app.use("/", (req, res, next) => {
  if (req.url.startsWith("/api/")) {
    return next();
  }
  return apiRouter(req, res, next);
});

export default app;
