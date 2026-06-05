import { Telegraf } from "telegraf";
import { registerBotMiddleware } from "./bot/middleware.js";
import { registerBotCommands } from "./bot/commands.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.warn("TELEGRAM_BOT_TOKEN is not set. Bot features will be disabled.");
}

export const bot = BOT_TOKEN ? new Telegraf(BOT_TOKEN) : null;

// Re-export leaves utility so other files can import it statically from here
export { checkAndRecordLeavesForGroup } from "./bot/leaves.js";

if (bot) {
  // Register all event listeners, real-time trackers, and link auditors
  registerBotMiddleware(bot);

  // Register commands such as #contest, /auth, and /sync
  registerBotCommands(bot);

  // Only launch polling if NOT running on Vercel
  const isVercel = process.env.VERCEL === "1" || process.env.NOW_DEPLOYMENT !== undefined;
  if (!isVercel) {
    bot.launch({
      allowedUpdates: ["message", "chat_member", "my_chat_member", "callback_query"]
    })
      .then(() => {
        console.log("Telegram bot started in POLLING mode (local development)");
      })
      .catch((err) => {
        console.error("Failed to start bot in polling mode:", err);
      });
  } else {
    console.log("Running in Vercel/Serverless environment. Polling disabled; waiting for webhook updates.");
  }
}
