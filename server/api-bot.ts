import { Router } from "express";
import { bot } from "./bot.js";
import { checkDatabase } from "./db.js";

const router = Router();

// Universal webhook handler (works on Cloud Run, Vercel, and custom domains)
router.post("/telegram-webhook", async (req, res) => {
  const secretHeader = req.headers["x-telegram-bot-api-secret-token"];
  
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    console.warn("[Webhook] Unauthorized call detected - invalid secret token");
    return res.status(403).send("Unauthorized");
  }

  if (!bot) {
    console.warn("[Webhook] Bot is not initialized (TELEGRAM_BOT_TOKEN is missing).");
    return res.status(503).send("Bot is not configured");
  }

  try {
    const update = req.body;
    if (update?.callback_query) {
      console.log(`[Webhook] callback_query received: id=${update.callback_query.id}, data="${update.callback_query.data}", from=${update.callback_query.from?.id}`);
    } else if (update?.message) {
      console.log(`[Webhook] message received: text="${update.message.text}", from=${update.message.from?.id}`);
    }

    await bot.handleUpdate(update);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error("[Webhook] Error handling update:", err);
    res.status(500).send("Error processing update");
  }
});

// Diagnostic endpoint to inspect bot, webhook status, and allowed_updates
router.get("/bot-diagnostics", async (req, res) => {
  if (!bot) {
    return res.status(503).json({
      configured: false,
      error: "TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi kiritilmagan!"
    });
  }

  try {
    const botInfo = await bot.telegram.getMe();
    const webhookInfo = await bot.telegram.getWebhookInfo();

    const allowedUpdates = webhookInfo.allowed_updates || [];
    const hasCallbackQuery = allowedUpdates.length === 0 || allowedUpdates.includes("callback_query");
    const isWebhookActive = !!webhookInfo.url;

    // Check database connection and groups
    let dbStatus = "OK";
    let dbGroupsCount = 0;
    try {
      const db = checkDatabase();
      const { data, error } = await db.from("groups").select("id");
      if (error) dbStatus = `DB Xatolik: ${error.message}`;
      else dbGroupsCount = data?.length || 0;
    } catch (e: any) {
      dbStatus = e.message;
    }

    const issues: string[] = [];
    if (isWebhookActive && allowedUpdates.length > 0 && !allowedUpdates.includes("callback_query")) {
      issues.push("⚠️ Vebxukda 'callback_query' ruxsat etilmagan! Shu sababli Telegram tugma bosilishlarini yubormaydi.");
    }
    if (webhookInfo.last_error_message) {
      issues.push(`⚠️ Telegram vebxuk yetkazib berish xatoligi: ${webhookInfo.last_error_message}`);
    }
    if (webhookInfo.pending_update_count > 50) {
      issues.push(`⚠️ Kutayotgan xabarlar soni ko'p: ${webhookInfo.pending_update_count} ta.`);
    }

    res.json({
      configured: true,
      bot: {
        id: botInfo.id,
        first_name: botInfo.first_name,
        username: botInfo.username
      },
      mode: isWebhookActive ? "WEBHOOK" : "POLLING",
      webhook: {
        url: webhookInfo.url,
        has_custom_certificate: webhookInfo.has_custom_certificate,
        pending_update_count: webhookInfo.pending_update_count,
        last_error_date: webhookInfo.last_error_date 
          ? new Date(webhookInfo.last_error_date * 1000).toLocaleString("uz-UZ") 
          : null,
        last_error_message: webhookInfo.last_error_message || null,
        allowed_updates: allowedUpdates,
        hasCallbackQuery
      },
      db: {
        status: dbStatus,
        groupsCount: dbGroupsCount
      },
      issues
    });
  } catch (err: any) {
    console.error("[Bot Diagnostics Error]:", err);
    res.status(500).json({
      configured: true,
      error: err.message || "Diagnostika ma'lumotlarini yuklashda xatolik yuz berdi"
    });
  }
});

// One-click endpoint to register/fix webhook with callback_query explicitly allowed
router.post("/bot-set-webhook", async (req, res) => {
  if (!bot) {
    return res.status(503).json({ success: false, error: "Bot ishga tushirilmagan!" });
  }

  try {
    const protocol = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    
    // Allow custom target URL or derive from current request host
    const targetUrl = req.body?.webhookUrl || `${protocol}://${host}/api/telegram-webhook`;

    await bot.telegram.setWebhook(targetUrl, {
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message", "chat_member", "my_chat_member", "callback_query"]
    });

    const info = await bot.telegram.getWebhookInfo();

    console.log(`[Bot Webhook] Successfully registered to: ${targetUrl}`);
    res.json({
      success: true,
      message: "Vebxuk muvaffaqiyatli bog'landi va 'callback_query' (tugmalar) yoqildi!",
      webhookUrl: targetUrl,
      info
    });
  } catch (err: any) {
    console.error("[Bot Set Webhook Error]:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Vebxukni o'rnatishda xatolik yuz berdi"
    });
  }
});

// Endpoint to delete webhook (to allow polling for local/container dev without 409 conflict)
router.post("/bot-delete-webhook", async (req, res) => {
  if (!bot) {
    return res.status(503).json({ success: false, error: "Bot ishga tushirilmagan!" });
  }

  try {
    await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    console.log("[Bot Webhook] Deleted webhook - bot can now use polling without 409 conflict");
    res.json({
      success: true,
      message: "Vebxuk o'chirildi. Bot endi Polling rejimida ishlashi mumkin."
    });
  } catch (err: any) {
    console.error("[Bot Delete Webhook Error]:", err);
    res.status(500).json({
      success: false,
      error: err.message || "Vebxukni o'chirishda xatolik"
    });
  }
});

export default router;
