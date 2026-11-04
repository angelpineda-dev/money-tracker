// One-time code a user sends to the bot with /link to bind their Telegram chat.
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const LINK_CODE_LENGTH = 8;
// No 0/O/1/I so codes are easy to type from the app into Telegram.
export const LINK_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
