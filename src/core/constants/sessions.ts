// Session / token lifetimes and limits. Each refresh_tokens row is one session (JWT `sid`).
export const ACCESS_TOKEN_TTL = '15m';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Max concurrent sessions per user; logging in beyond this evicts the oldest.
export const MAX_ACTIVE_SESSIONS = 3;
