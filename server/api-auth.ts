import { Router } from "express";
import { bot } from "./bot.js";
import { verifyCode } from "./auth-store.js";

const router = Router();

// Verification endpoint for 6-digit codes
router.post("/auth/verify", async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ valid: false, error: "Tasdiqlash kodi kiritilmagan!" });
    }
    
    const verified = await verifyCode(code);
    
    if (!verified) {
      return res.status(400).json({ valid: false, error: "Xato yoki muddati o'tgan kod kiritildi!" });
    }
    
    res.json({
      valid: true,
      chatId: verified.chatId,
      chatTitle: verified.chatTitle
    });
  } catch (error: any) {
    console.error("Auth verify error:", error);
    res.status(500).json({ valid: false, error: error.message || "Tizim xatoligi yuz berdi" });
  }
});

// System modules configuration status check endpoint
router.get("/config-status", (req, res) => {
  const supabaseConfigured = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_ANON_KEY;
  const telegramTokenConfigured = !!process.env.TELEGRAM_BOT_TOKEN;
  const botInitialized = bot !== null;
  
  let statusText = "Bot faol holatda";
  let statusCode = "SUCCESS";
  
  if (!supabaseConfigured && !telegramTokenConfigured) {
    statusText = "Bot va Baza sozlanmagan (Demo rejim)";
    statusCode = "DEMO_ALL_MISSING";
  } else if (!supabaseConfigured) {
    statusText = "Baza sozlanmagan (Supabase ulanmagan)";
    statusCode = "SUPABASE_MISSING";
  } else if (!telegramTokenConfigured) {
    statusText = "Bot token moduli yo'q (Faqat baza faol)";
    statusCode = "TELEGRAM_MISSING";
  } else if (!botInitialized) {
    statusText = "Bot ishga tushmagan (Tokenni tekshiring)";
    statusCode = "BOT_ERROR";
  } else {
    statusText = "Bot faol holatda (Baza bog'langan)";
    statusCode = "ACTIVE";
  }

  res.json({
    supabaseConfigured,
    telegramTokenConfigured,
    botInitialized,
    statusText,
    statusCode
  });
});

export default router;
