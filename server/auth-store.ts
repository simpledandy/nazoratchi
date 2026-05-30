export interface VerificationCode {
  code: string;
  chatId: string;
  chatTitle: string;
  userId: string;
  expiresAt: number;
}

// In-memory store for verification codes
const codes = new Map<string, VerificationCode>();

export function generateVerificationCode(chatId: string, chatTitle: string, userId: string): string {
  // Generate a random 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Clean up expired codes
  const now = Date.now();
  for (const [c, info] of codes.entries()) {
    if (info.expiresAt < now) {
      codes.delete(c);
    }
  }
  
  codes.set(code, {
    code,
    chatId,
    chatTitle,
    userId,
    expiresAt: now + 10 * 60 * 1000 // 10 minutes lifetime
  });
  
  return code;
}

export function verifyCode(code: string): VerificationCode | null {
  const info = codes.get(code);
  if (!info) return null;
  
  if (info.expiresAt < Date.now()) {
    codes.delete(code);
    return null;
  }
  
  // Single-use code
  codes.delete(code);
  return info;
}
