const KEY_PREFIX = 'inventia:pwd-rate:';
const DEFAULT_MAX_ATTEMPTS = Number(process.env.PASSWORD_CHANGE_MAX_ATTEMPTS || 5);
const DEFAULT_WINDOW_MS = Number(process.env.PASSWORD_CHANGE_WINDOW_MS || (10 * 60 * 1000));
const DEFAULT_LOCK_MS = Number(process.env.PASSWORD_CHANGE_LOCK_MS || (15 * 60 * 1000));

const memoryStore = new Map();

function getConfig() {
  return {
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    windowMs: DEFAULT_WINDOW_MS,
    lockMs: DEFAULT_LOCK_MS,
  };
}

function normalizeIp(rawIp) {
  const raw = String(rawIp || '').trim();
  if (!raw) return 'unknown';
  return raw.split(',')[0].trim() || 'unknown';
}

function buildPasswordLimiterKey(userId, ipOrForwardedFor) {
  const ip = normalizeIp(ipOrForwardedFor);
  return `${KEY_PREFIX}${userId}:${ip}`;
}

function parseState(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = JSON.parse(rawValue);
    return {
      attempts: Number(parsed.attempts || 0),
      windowStart: Number(parsed.windowStart || Date.now()),
      lockedUntil: Number(parsed.lockedUntil || 0),
    };
  } catch {
    return null;
  }
}

function getInitialState() {
  return {
    attempts: 0,
    windowStart: Date.now(),
    lockedUntil: 0,
  };
}

function getStateTtlMs(state, config) {
  const now = Date.now();
  const lockRemaining = Math.max(state.lockedUntil - now, 0);
  const windowRemaining = Math.max((state.windowStart + config.windowMs) - now, 0);
  const base = Math.max(lockRemaining, windowRemaining, config.windowMs);
  return Math.max(base + (2 * 60 * 1000), 60 * 1000);
}

async function readState(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.state;
}

async function writeState(key, state, config) {
  const ttlMs = getStateTtlMs(state, config);

  memoryStore.set(key, {
    state,
    expiresAt: Date.now() + ttlMs,
  });
}

async function clearState(key) {
  memoryStore.delete(key);
}

function normalizeStateWindow(state, config) {
  const now = Date.now();
  if (now - state.windowStart > config.windowMs) {
    state.attempts = 0;
    state.windowStart = now;
  }
  return state;
}

async function getLimiterState(key) {
  const config = getConfig();
  const state = normalizeStateWindow((await readState(key)) || getInitialState(), config);
  return { state, config };
}

async function getPasswordLimiterStatus(key) {
  const { state } = await getLimiterState(key);
  const now = Date.now();
  if (state.lockedUntil > now) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
    };
  }
  return { blocked: false, retryAfterSeconds: 0 };
}

async function registerPasswordLimiterFailure(key) {
  const { state, config } = await getLimiterState(key);
  const now = Date.now();

  state.attempts += 1;

  if (state.attempts >= config.maxAttempts) {
    state.lockedUntil = now + config.lockMs;
    state.attempts = 0;
    state.windowStart = now;
    await writeState(key, state, config);

    return {
      locked: true,
      retryAfterSeconds: Math.ceil(config.lockMs / 1000),
      attemptsRemaining: 0,
    };
  }

  await writeState(key, state, config);

  return {
    locked: false,
    retryAfterSeconds: 0,
    attemptsRemaining: Math.max(config.maxAttempts - state.attempts, 0),
  };
}

async function clearPasswordLimiter(key) {
  await clearState(key);
}

module.exports = {
  buildPasswordLimiterKey,
  getPasswordLimiterStatus,
  registerPasswordLimiterFailure,
  clearPasswordLimiter,
};
