// Server-side utility functions

/**
 * Extract verified chat IDs list from request auth headers.
 */
export function getVerifiedChats(req: any): string[] {
  const verifiedHeader = req.headers["x-verified-chats"] as string;
  if (!verifiedHeader) return [];
  return verifiedHeader.split(",").filter(Boolean);
}
