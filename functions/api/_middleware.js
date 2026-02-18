const MAX_BODY_SIZE = 1024 * 1024;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 8;

const ROLE_OWNER = "owner";
const ROLE_HELP = "help";
const ROLE_MANAGER = "manager";
const ROLE_WORKER = "worker";

const ADMIN_ROLES = new Set([ROLE_OWNER, ROLE_HELP, ROLE_MANAGER, ROLE_WORKER]);
const LEAD_STATUSES = new Set(["new", "in_progress", "done"]);
const LEAD_PRIORITIES = new Set(["low", "normal", "high"]);
const DEFAULT_DEPARTMENT = "unassigned";
const CORE_USER_IDS = new Set(["owner", "sales_help", "production_help"]);
const ADMIN_AUTH_DISABLED = true;
const RECOVERY_ADMIN_PASSWORD = "MyStrongAdminPass_2026";

const enc = new TextEncoder();
const dec = new TextDecoder();
let schemaReady = null;
const hmacKeys = new Map();

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};

function isD1Database(candidate) {
  return (
    Boolean(candidate) &&
    typeof candidate === "object" &&
    typeof candidate.prepare === "function" &&
    (typeof candidate.exec === "function" || typeof candidate.batch === "function")
  );
}

function getDb(env) {
  const db = env.DB || env.DB1 || env.DATABASE || env.APP_DB || env.db || env.database || env.app_db || null;
  if (isD1Database(db)) {
    return db;
  }

  if (!env || typeof env !== "object") {
    return null;
  }

  // Fallback for custom binding names: pick the first D1-like binding.
  for (const value of Object.values(env)) {
    if (isD1Database(value)) {
      return value;
    }
  }

  return null;
}

const json = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS
    }
  });

const clean = (value, maxLen) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLen);

const normRole = (value) => {
  const role = clean(value, 30).toLowerCase();
  return ADMIN_ROLES.has(role) ? role : ROLE_HELP;
};

const normDept = (value) => clean(value, 80).toLowerCase() || DEFAULT_DEPARTMENT;
const normUid = (value, fallback = "user") =>
  clean(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || fallback;
const normLeadStatus = (value) => (LEAD_STATUSES.has(clean(value, 30)) ? clean(value, 30) : "new");
const normLeadPriority = (value) =>
  LEAD_PRIORITIES.has(clean(value, 20)) ? clean(value, 20) : "normal";

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const b64u = (bytes) =>
  bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const u64b = (value) => {
  const base64 = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return base64ToBytes(`${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`);
};

const randomHex = (n) => {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (v) => v.toString(16).padStart(2, "0")).join("");
};

const initData = () => ({
  visits: { totalHits: 0, uniqueVisitors: 0, knownVisitors: {}, byDay: {} },
  engagement: { totalDurationMs: 0, samplesCount: 0, byPage: {} },
  secrets: { totalEvents: 0, bySecret: {}, byVisitor: {} },
  leads: []
});

function normDayEntry(input) {
  const entry = input && typeof input === "object" ? input : {};
  return {
    hits: Number.isFinite(Number(entry.hits)) ? Number(entry.hits) : 0,
    uniqueVisitors: Number.isFinite(Number(entry.uniqueVisitors)) ? Number(entry.uniqueVisitors) : 0,
    visitors: entry.visitors && typeof entry.visitors === "object" ? entry.visitors : {}
  };
}

function normEngEntry(input) {
  const entry = input && typeof input === "object" ? input : {};
  return {
    durationMs: Number.isFinite(Number(entry.durationMs)) ? Math.max(0, Number(entry.durationMs)) : 0,
    samples: Number.isFinite(Number(entry.samples)) ? Math.max(0, Number(entry.samples)) : 0
  };
}

function normEngData(input) {
  const source = input && typeof input === "object" ? input : {};
  const byPageInput = source.byPage && typeof source.byPage === "object" ? source.byPage : {};
  const byPage = {};
  for (const [page, entry] of Object.entries(byPageInput)) {
    byPage[page] = normEngEntry(entry);
  }
  return {
    totalDurationMs: Number.isFinite(Number(source.totalDurationMs))
      ? Math.max(0, Number(source.totalDurationMs))
      : 0,
    samplesCount: Number.isFinite(Number(source.samplesCount))
      ? Math.max(0, Number(source.samplesCount))
      : 0,
    byPage
  };
}

function normSecretVisitor(input) {
  const entry = input && typeof input === "object" ? input : {};
  const uniqIn = entry.uniqueSecrets && typeof entry.uniqueSecrets === "object" ? entry.uniqueSecrets : {};
  const uniqueSecrets = {};
  for (const secret of Object.keys(uniqIn)) uniqueSecrets[secret] = true;
  return {
    totalEvents: Number.isFinite(Number(entry.totalEvents)) ? Math.max(0, Number(entry.totalEvents)) : 0,
    uniqueSecrets
  };
}

function normSecrets(input) {
  const source = input && typeof input === "object" ? input : {};
  const bySecretIn = source.bySecret && typeof source.bySecret === "object" ? source.bySecret : {};
  const byVisitorIn = source.byVisitor && typeof source.byVisitor === "object" ? source.byVisitor : {};
  const bySecret = {};
  const byVisitor = {};
  for (const [secret, count] of Object.entries(bySecretIn)) {
    bySecret[secret] = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  }
  for (const [visitorId, entry] of Object.entries(byVisitorIn)) {
    byVisitor[visitorId] = normSecretVisitor(entry);
  }
  return {
    totalEvents: Number.isFinite(Number(source.totalEvents)) ? Math.max(0, Number(source.totalEvents)) : 0,
    bySecret,
    byVisitor
  };
}

function normLead(input) {
  const source = input && typeof input === "object" ? input : {};
  const seed = clean(source.createdAt, 64) || clean(source.name, 40) || "legacy";
  const fallbackId = `lead_legacy_${b64u(enc.encode(seed)).slice(0, 12)}`;
  return {
    id: clean(source.id, 120) || fallbackId,
    name: clean(source.name, 120),
    contact: clean(source.contact, 140),
    type: clean(source.type, 80),
    message: clean(source.message, 2000),
    sourcePage: clean(source.sourcePage, 120) || "contact.html",
    status: normLeadStatus(source.status),
    department: normDept(source.department || DEFAULT_DEPARTMENT),
    assigneeId: normUid(source.assigneeId, ""),
    assigneeName: clean(source.assigneeName, 120),
    priority: normLeadPriority(source.priority),
    internalNote: clean(source.internalNote, 2000),
    updatedById: normUid(source.updatedById, ""),
    updatedByName: clean(source.updatedByName, 120),
    createdAt: clean(source.createdAt, 64) || new Date().toISOString(),
    updatedAt: clean(source.updatedAt, 64) || new Date().toISOString()
  };
}

function normData(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const visitsIn = base.visits && typeof base.visits === "object" ? base.visits : {};
  const byDayIn = visitsIn.byDay && typeof visitsIn.byDay === "object" ? visitsIn.byDay : {};
  const byDay = {};
  for (const [date, entry] of Object.entries(byDayIn)) byDay[date] = normDayEntry(entry);
  return {
    visits: {
      totalHits: Number.isFinite(Number(visitsIn.totalHits)) ? Number(visitsIn.totalHits) : 0,
      uniqueVisitors: Number.isFinite(Number(visitsIn.uniqueVisitors)) ? Number(visitsIn.uniqueVisitors) : 0,
      knownVisitors:
        visitsIn.knownVisitors && typeof visitsIn.knownVisitors === "object" ? visitsIn.knownVisitors : {},
      byDay
    },
    engagement: normEngData(base.engagement),
    secrets: normSecrets(base.secrets),
    leads: Array.isArray(base.leads) ? base.leads.map((lead) => normLead(lead)) : []
  };
}

const pubUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  department: user.department
});

const rolePerms = (role) => ({
  canViewStats: role === ROLE_OWNER,
  canAssignLeads: role === ROLE_OWNER || role === ROLE_MANAGER,
  canViewAllLeads: role === ROLE_OWNER
});

function defaultUsers(env) {
  const ownerPassword = String(env.ADMIN_PASSWORD || RECOVERY_ADMIN_PASSWORD).trim().slice(0, 200);
  return [
    {
      id: "owner",
      username: "admin",
      password: ownerPassword || RECOVERY_ADMIN_PASSWORD,
      name: "Owner",
      role: ROLE_OWNER,
      department: "management"
    },
    {
      id: "sales_help",
      username: String(env.SALES_HELP_LOGIN || "sales_help"),
      password: String(env.SALES_HELP_PASSWORD || "change-sales-help"),
      name: "Sales Help",
      role: ROLE_HELP,
      department: "sales"
    },
    {
      id: "production_help",
      username: String(env.PRODUCTION_HELP_LOGIN || "production_help"),
      password: String(env.PRODUCTION_HELP_PASSWORD || "change-production-help"),
      name: "Production Help",
      role: ROLE_HELP,
      department: "production"
    }
  ];
}

function normAdminUser(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = normUid(source.id, `user_${index + 1}`);
  const username = normUid(source.username, id);
  const password = String(source.password || "").trim();
  if (!password) return null;
  return {
    id,
    username,
    password,
    name: clean(source.name, 120) || username,
    role: normRole(source.role),
    department: normDept(source.department)
  };
}

function buildUsers(rawUsers, env) {
  const users = [];
  const knownIds = new Set();
  const knownUsernames = new Set();
  for (const [index, rawUser] of (Array.isArray(rawUsers) ? rawUsers : []).entries()) {
    const user = normAdminUser(rawUser, index);
    if (!user) continue;
    if (knownIds.has(user.id) || knownUsernames.has(user.username)) continue;
    knownIds.add(user.id);
    knownUsernames.add(user.username);
    users.push(user);
  }
  if (users.length === 0) {
    const owner = normAdminUser(defaultUsers(env)[0], 0);
    if (owner) users.push(owner);
  }
  return users;
}

function initialUsers(env) {
  const raw = String(env.ADMIN_USERS_JSON || "").trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const users = buildUsers(parsed, env);
        if (users.length > 0) return users;
      }
    } catch (error) {
      console.error("ADMIN_USERS_JSON parse failed:", error?.message || error);
    }
  }
  return buildUsers(defaultUsers(env), env);
}

const normStoredUsers = (input, env) => {
  const users = buildUsers(input, env);
  return users.length > 0 ? users : initialUsers(env);
};

function enforceOwnerReset(users, env) {
  const ownerPassword = String(env.ADMIN_PASSWORD || RECOVERY_ADMIN_PASSWORD).trim().slice(0, 200) || RECOVERY_ADMIN_PASSWORD;
  const ownerTemplate = {
    id: "owner",
    username: "admin",
    password: ownerPassword,
    name: "Owner",
    role: ROLE_OWNER,
    department: "management"
  };

  const ownerIndex = users.findIndex(
    (user) => user.id === "owner" || user.username === "admin" || user.role === ROLE_OWNER
  );

  if (ownerIndex < 0) {
    users.unshift(ownerTemplate);
    return;
  }

  const owner = users[ownerIndex];
  owner.id = "owner";
  owner.username = "admin";
  if (!String(owner.password || "").trim()) {
    owner.password = ownerPassword;
  }
  owner.name = "Owner";
  owner.role = ROLE_OWNER;
  owner.department = "management";

  if (ownerIndex !== 0) {
    users.splice(ownerIndex, 1);
    users.unshift(owner);
  }
}

function userCtx(users) {
  const byId = new Map();
  const byUsername = new Map();
  users.forEach((user) => {
    byId.set(user.id, user);
    byUsername.set(user.username, user);
  });
  return { byId, byUsername };
}

function actorFrom(payload, users, ctx) {
  if (!payload || typeof payload !== "object") return null;
  const uid = normUid(payload.userId, "");
  if (uid) {
    const user = ctx.byId.get(uid);
    if (user) return pubUser(user);
  }
  if (payload.role === "admin") {
    const owner = users.find((user) => user.role === ROLE_OWNER) || users[0];
    return owner ? pubUser(owner) : null;
  }
  return null;
}

const canViewStats = (actor) => Boolean(actor && actor.role === ROLE_OWNER);
const canAssign = (actor) => Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_MANAGER));
const canManageUsers = (actor) => Boolean(actor && actor.role === ROLE_OWNER);

function canReadLead(actor, lead) {
  if (!actor || !lead) return false;
  if (actor.role === ROLE_OWNER) return true;
  if (actor.role === ROLE_MANAGER) {
    return (
      lead.department === actor.department ||
      lead.department === DEFAULT_DEPARTMENT ||
      lead.assigneeId === actor.id
    );
  }
  return lead.assigneeId === actor.id;
}

const canManageTargetDept = (actor, dept) =>
  actor && (actor.role === ROLE_OWNER || (actor.role === ROLE_MANAGER && dept === actor.department));
const canAssignTargetUser = (actor, user) =>
  actor &&
  user &&
  (actor.role === ROLE_OWNER || (actor.role === ROLE_MANAGER && user.department === actor.department));
const canUpdateStatus = (actor, lead) =>
  actor &&
  lead &&
  (actor.role === ROLE_OWNER ||
    (actor.role === ROLE_MANAGER && canReadLead(actor, lead)) ||
    lead.assigneeId === actor.id);

const dayKey = (date = new Date()) => date.toISOString().slice(0, 10);
function lastDays(byDay, count) {
  const days = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - i);
    const key = dayKey(date);
    const entry = normDayEntry(byDay[key]);
    days.push({ date: key, hits: entry.hits, uniqueVisitors: entry.uniqueVisitors });
  }
  return days;
}

function knownDepts(data, users) {
  const out = new Set([DEFAULT_DEPARTMENT]);
  users.forEach((user) => user.department && out.add(user.department));
  (Array.isArray(data?.leads) ? data.leads : []).forEach((leadInput) => {
    const lead = normLead(leadInput);
    if (lead.department) out.add(lead.department);
  });
  return Array.from(out);
}

const visibleDepts = (actor, data, users) =>
  !actor ? [DEFAULT_DEPARTMENT] : actor.role === ROLE_OWNER ? knownDepts(data, users) : [actor.department];

function safeEq(left, right) {
  const a = enc.encode(String(left || ""));
  const b = enc.encode(String(right || ""));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

const tokenSecret = (env) => String(env.TOKEN_SECRET || "change-me-secret");

async function getHmacKey(secret) {
  const value = String(secret || "");
  if (hmacKeys.has(value)) return hmacKeys.get(value);
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  hmacKeys.set(value, key);
  return key;
}

async function signEncoded(encoded, env) {
  const key = await getHmacKey(tokenSecret(env));
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(encoded));
  return b64u(new Uint8Array(sig));
}

async function signToken(payload, env) {
  const encoded = b64u(enc.encode(JSON.stringify(payload)));
  const signature = await signEncoded(encoded, env);
  return `${encoded}.${signature}`;
}

async function verifyToken(token, env) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot >= token.length - 1) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = await signEncoded(encoded, env);
  if (!safeEq(signature, expected)) return null;
  try {
    const payload = JSON.parse(dec.decode(u64b(encoded)));
    if (!payload || typeof payload !== "object") return null;
    if (!payload.exp || Date.now() > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

const bearer = (request) => {
  const header = request.headers.get("authorization") || "";
  const [type, token] = header.split(" ");
  return type === "Bearer" && token ? token : null;
};

const readAuthPayload = async (request, env) => {
  if (ADMIN_AUTH_DISABLED) {
    return {
      userId: "owner",
      role: ROLE_OWNER,
      department: "management",
      exp: Date.now() + TOKEN_TTL_MS
    };
  }
  const token = bearer(request);
  return token ? verifyToken(token, env) : null;
};

async function readBodyJson(request) {
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_SIZE) throw new Error("BODY_TOO_LARGE");
  if (bytes.byteLength === 0) return {};
  try {
    const parsed = JSON.parse(dec.decode(bytes));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    throw new Error("INVALID_JSON");
  }
}

async function ensureSchema(env) {
  const db = getDb(env);
  if (!db) throw new Error("DB_BINDING_MISSING");
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    // Avoid db.exec() because some runtime combinations throw opaque errors there.
    await db
      .prepare(
        `CREATE TABLE IF NOT EXISTS app_state (
          id INTEGER PRIMARY KEY CHECK(id = 1),
          data_json TEXT NOT NULL,
          admin_users_json TEXT NOT NULL,
          version INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        )`
      )
      .run();
    await db
      .prepare(
        "INSERT INTO app_state (id, data_json, admin_users_json, version, updated_at) VALUES (1, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING"
      )
      .bind(JSON.stringify(initData()), JSON.stringify(initialUsers(env)), new Date().toISOString())
      .run();
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

async function loadState(env) {
  const db = getDb(env);
  if (!db) throw new Error("DB_BINDING_MISSING");
  await ensureSchema(env);
  const row = await db
    .prepare("SELECT data_json, admin_users_json, version FROM app_state WHERE id = 1")
    .first();
  if (!row) {
    schemaReady = null;
    await ensureSchema(env);
    return loadState(env);
  }
  let dataRaw = initData();
  let usersRaw = [];
  try {
    dataRaw = JSON.parse(String(row.data_json || ""));
  } catch {}
  try {
    usersRaw = JSON.parse(String(row.admin_users_json || "[]"));
  } catch {}
  const users = normStoredUsers(usersRaw, env);
  enforceOwnerReset(users, env);

  return {
    version: Number(row.version) || 1,
    data: normData(dataRaw),
    users
  };
}

async function mutateState(env, mutator) {
  const db = getDb(env);
  if (!db) throw new Error("DB_BINDING_MISSING");
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const state = await loadState(env);
    const ctx = userCtx(state.users);
    const outcome = await mutator({ data: state.data, users: state.users, ctx });
    if (outcome && outcome.noWrite) return outcome.result;
    const run = await db
      .prepare(
        "UPDATE app_state SET data_json = ?, admin_users_json = ?, version = version + 1, updated_at = ? WHERE id = 1 AND version = ?"
      )
      .bind(
        JSON.stringify(state.data),
        JSON.stringify(state.users),
        new Date().toISOString(),
        state.version
      )
      .run();
    if (Number(run?.meta?.changes || 0) > 0) return outcome?.result;
  }
  throw new Error("STATE_UPDATE_CONFLICT");
}

const decodePath = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
};

function visibleUsers(actor, users, ctx) {
  if (!actor) return [];
  if (actor.role === ROLE_OWNER) return users.map((user) => pubUser(user));
  if (actor.role === ROLE_MANAGER) {
    return users.filter((user) => user.department === actor.department).map((user) => pubUser(user));
  }
  const self = ctx.byId.get(actor.id);
  return self ? [pubUser(self)] : [];
}

export async function onRequest(context) {
  const request = context.request;
  const env = context.env;
  const url = new URL(request.url);
  const { pathname } = url;
  const method = String(request.method || "GET").toUpperCase();
  const debug = url.searchParams.get("debug") === "1";

  if (!pathname.startsWith("/api/")) return context.next();
  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (!getDb(env)) {
    return json(500, {
      error: "DB_BINDING_MISSING",
      hint: "Cloudflare Pages: Settings -> Functions/Bindings -> D1 database -> add binding named DB"
    });
  }

  try {
    if (pathname === "/api/health" && method === "GET") {
      // Make /api/health reflect DB readiness (schema + first row).
      await ensureSchema(env);
      return json(200, { ok: true, time: new Date().toISOString() });
    }

    if (pathname === "/api/visit" && method === "POST") {
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const visitorId = clean(body.visitorId, 120);
      const page = clean(body.path, 180);
      const referrer = clean(body.referrer, 220);
      const userAgent = clean(body.userAgent, 300);
      const today = dayKey();
      return mutateState(env, ({ data }) => {
        const entry = normDayEntry(data.visits.byDay[today]);
        data.visits.totalHits += 1;
        entry.hits += 1;
        if (visitorId && !entry.visitors[visitorId]) {
          entry.visitors[visitorId] = 1;
          entry.uniqueVisitors += 1;
        }
        if (visitorId && !data.visits.knownVisitors[visitorId]) {
          data.visits.knownVisitors[visitorId] = {
            firstSeen: new Date().toISOString(),
            sourcePage: page || "unknown",
            referrer: referrer || "direct",
            userAgent: userAgent || "unknown"
          };
          data.visits.uniqueVisitors += 1;
        }
        data.visits.byDay[today] = entry;
        return { result: json(201, { ok: true }) };
      });
    }

    if (pathname === "/api/engagement" && method === "POST") {
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const visitorId = clean(body.visitorId, 120);
      const page = clean(body.path, 180);
      const rawDuration = Number(body.durationMs);
      if (!Number.isFinite(rawDuration) || rawDuration < 0) return json(400, { error: "INVALID_DURATION" });
      const durationMs = Math.min(Math.round(rawDuration), 1000 * 60 * 60 * 4);
      if (durationMs <= 0) return json(201, { ok: true });
      return mutateState(env, ({ data }) => {
        const engagement = normEngData(data.engagement);
        const pageKey = page || "unknown";
        const pageEntry = normEngEntry(engagement.byPage[pageKey]);
        engagement.totalDurationMs += durationMs;
        engagement.samplesCount += 1;
        pageEntry.durationMs += durationMs;
        pageEntry.samples += 1;
        engagement.byPage[pageKey] = pageEntry;
        data.engagement = engagement;
        if (visitorId && data.visits.knownVisitors[visitorId]) {
          data.visits.knownVisitors[visitorId].lastSeen = new Date().toISOString();
        }
        return { result: json(201, { ok: true }) };
      });
    }

    if (pathname === "/api/secret" && method === "POST") {
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const visitorId = clean(body.visitorId, 120);
      const page = clean(body.path, 180);
      const secret = clean(body.secret, 80).toLowerCase();
      if (!secret) return json(400, { error: "SECRET_REQUIRED" });
      return mutateState(env, ({ data }) => {
        const secrets = normSecrets(data.secrets);
        secrets.totalEvents += 1;
        secrets.bySecret[secret] = (Number(secrets.bySecret[secret]) || 0) + 1;
        if (visitorId) {
          const visitorEntry = normSecretVisitor(secrets.byVisitor[visitorId]);
          visitorEntry.totalEvents += 1;
          visitorEntry.uniqueSecrets[secret] = true;
          secrets.byVisitor[visitorId] = visitorEntry;
        }
        data.secrets = secrets;
        if (visitorId && page && data.visits.knownVisitors[visitorId]) {
          data.visits.knownVisitors[visitorId].lastSecretPage = page;
        }
        return { result: json(201, { ok: true }) };
      });
    }

    if (pathname === "/api/leads" && method === "POST") {
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const name = clean(body.name, 120);
      const contact = clean(body.contact, 140);
      const type = clean(body.type, 80);
      const message = clean(body.message, 2000);
      const sourcePage = clean(body.sourcePage, 120);
      if (!name || !contact || !type) return json(400, { error: "NAME_CONTACT_TYPE_REQUIRED" });
      const lead = {
        id: `lead_${Date.now()}_${randomHex(4)}`,
        name,
        contact,
        type,
        message,
        sourcePage: sourcePage || "contact.html",
        status: "new",
        department: DEFAULT_DEPARTMENT,
        assigneeId: "",
        assigneeName: "",
        priority: "normal",
        internalNote: "",
        updatedById: "",
        updatedByName: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return mutateState(env, ({ data }) => {
        data.leads.unshift(lead);
        if (data.leads.length > 5000) data.leads.length = 5000;
        return { result: json(201, { ok: true, leadId: lead.id }) };
      });
    }

    if (pathname === "/api/admin/login" && method === "POST") {
      if (ADMIN_AUTH_DISABLED) {
        return json(410, { error: "PASSWORD_LOGIN_DISABLED" });
      }
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const username = normUid(body.username, "");
      const password = String(body.password || "").trim().slice(0, 200);
      if (!username || !password) return json(401, { error: "INVALID_CREDENTIALS" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const user = ctx.byUsername.get(username);
      const overrideAdminPassword = String(env.ADMIN_PASSWORD || "").trim().slice(0, 200);
      const isOwnerOverrideLogin =
        Boolean(user) &&
        user.role === ROLE_OWNER &&
        Boolean(overrideAdminPassword) &&
        password === overrideAdminPassword;

      if (!user || (user.password !== password && !isOwnerOverrideLogin)) {
        return json(401, { error: "INVALID_CREDENTIALS" });
      }

      if (isOwnerOverrideLogin && user.password !== overrideAdminPassword) {
        await mutateState(env, ({ users, ctx: freshCtx }) => {
          const target = freshCtx.byId.get(user.id);
          if (target) {
            target.password = overrideAdminPassword;
          }
          return { result: null };
        });
      }

      const actor = pubUser(user);
      const exp = Date.now() + TOKEN_TTL_MS;
      const token = await signToken(
        { userId: actor.id, role: actor.role, department: actor.department, exp },
        env
      );
      return json(200, {
        ok: true,
        token,
        expiresAt: new Date(exp).toISOString(),
        actor,
        permissions: rolePerms(actor.role)
      });
    }

    if (pathname === "/api/admin/me" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      return json(200, { ok: true, actor, permissions: rolePerms(actor.role) });
    }

    if (pathname === "/api/admin/team" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      return json(200, {
        ok: true,
        actor,
        permissions: rolePerms(actor.role),
        users: visibleUsers(actor, state.users, ctx),
        departments: visibleDepts(actor, state.data, state.users)
      });
    }

    if (pathname === "/api/admin/password" && method === "PATCH") {
      if (ADMIN_AUTH_DISABLED) {
        return json(410, { error: "PASSWORD_LOGIN_DISABLED" });
      }
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }

      const currentPassword = String(body.currentPassword || "").trim().slice(0, 200);
      const newPassword = String(body.newPassword || "").trim().slice(0, 200);

      if (!currentPassword) return json(400, { error: "CURRENT_PASSWORD_REQUIRED" });
      if (!newPassword) return json(400, { error: "NEW_PASSWORD_REQUIRED" });
      if (newPassword.length < 8) return json(400, { error: "PASSWORD_TOO_SHORT" });
      if (newPassword === currentPassword) return json(400, { error: "PASSWORD_SAME_AS_CURRENT" });

      return mutateState(env, ({ users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };

        const target = ctx.byId.get(actor.id);
        if (!target) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        if (target.password !== currentPassword) {
          return { noWrite: true, result: json(400, { error: "INVALID_CURRENT_PASSWORD" }) };
        }

        target.password = newPassword;
        return { result: json(200, { ok: true }) };
      });
    }

    if (pathname === "/api/admin/users" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      if (!canManageUsers(actor)) return json(403, { error: "FORBIDDEN_USERS" });
      return json(200, { ok: true, users: state.users.map((user) => pubUser(user)) });
    }

    if (pathname === "/api/admin/users" && method === "POST") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      return mutateState(env, ({ users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        if (!canManageUsers(actor)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_USERS" }) };
        }
        const username = normUid(body.username, "");
        const password = randomHex(16);
        const name = clean(body.name, 120) || username;
        const department = normDept(body.department);
        if (!username) {
          return { noWrite: true, result: json(400, { error: "USERNAME_REQUIRED" }) };
        }
        if (ctx.byUsername.has(username)) {
          return { noWrite: true, result: json(400, { error: "USERNAME_TAKEN" }) };
        }
        const requestedId = normUid(body.id, `help_${username}`);
        let id = requestedId;
        let suffix = 1;
        while (ctx.byId.has(id)) {
          id = `${requestedId}_${suffix}`;
          suffix += 1;
        }
        const user = { id, username, password, name, role: ROLE_HELP, department };
        users.push(user);
        return { result: json(201, { ok: true, user: pubUser(user) }) };
      });
    }

    if (pathname.startsWith("/api/admin/users/") && method === "PATCH") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const id = decodePath(pathname.replace("/api/admin/users/", ""));
      if (!id) return json(400, { error: "USER_ID_REQUIRED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      return mutateState(env, ({ users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        if (!canManageUsers(actor)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_USERS" }) };
        }
        const target = ctx.byId.get(id);
        if (!target) return { noWrite: true, result: json(404, { error: "USER_NOT_FOUND" }) };
        if (target.role === ROLE_OWNER) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_OWNER_EDIT" }) };
        }
        if (CORE_USER_IDS.has(target.id)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_SYSTEM_USER" }) };
        }
        const hasUsername = Object.prototype.hasOwnProperty.call(body, "username");
        const hasPassword = Object.prototype.hasOwnProperty.call(body, "password");
        const canUpdatePassword = hasPassword && !ADMIN_AUTH_DISABLED;
        const hasName = Object.prototype.hasOwnProperty.call(body, "name");
        const hasDepartment = Object.prototype.hasOwnProperty.call(body, "department");
        if (!hasUsername && !canUpdatePassword && !hasName && !hasDepartment) {
          return { noWrite: true, result: json(400, { error: "NO_UPDATABLE_FIELDS" }) };
        }
        const nextUsername = hasUsername ? normUid(body.username, "") : target.username;
        const nextPassword = canUpdatePassword
          ? String(body.password || "").trim().slice(0, 200)
          : target.password;
        const nextName = hasName ? clean(body.name, 120) || target.name : target.name;
        const nextDepartment = hasDepartment ? normDept(body.department) : target.department;
        if (hasUsername && !nextUsername) {
          return { noWrite: true, result: json(400, { error: "INVALID_USERNAME" }) };
        }
        if (canUpdatePassword && !nextPassword) {
          return { noWrite: true, result: json(400, { error: "INVALID_PASSWORD" }) };
        }
        if (nextUsername !== target.username) {
          const existing = ctx.byUsername.get(nextUsername);
          if (existing && existing.id !== target.id) {
            return { noWrite: true, result: json(400, { error: "USERNAME_TAKEN" }) };
          }
          target.username = nextUsername;
        }
        target.password = nextPassword;
        target.name = nextName;
        target.department = nextDepartment;
        return { result: json(200, { ok: true, user: pubUser(target) }) };
      });
    }

    if (pathname.startsWith("/api/admin/users/") && method === "DELETE") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const id = decodePath(pathname.replace("/api/admin/users/", ""));
      if (!id) return json(400, { error: "USER_ID_REQUIRED" });
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        if (!canManageUsers(actor)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_USERS" }) };
        }
        const target = ctx.byId.get(id);
        if (!target) return { noWrite: true, result: json(404, { error: "USER_NOT_FOUND" }) };
        if (target.role === ROLE_OWNER) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_OWNER_EDIT" }) };
        }
        if (CORE_USER_IDS.has(target.id)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_SYSTEM_USER" }) };
        }
        const index = users.findIndex((user) => user.id === target.id);
        if (index < 0) return { noWrite: true, result: json(404, { error: "USER_NOT_FOUND" }) };
        users.splice(index, 1);
        let unassignedLeads = 0;
        const now = new Date().toISOString();
        const leads = Array.isArray(data.leads) ? data.leads.map((lead) => normLead(lead)) : [];
        leads.forEach((lead) => {
          if (lead.assigneeId !== target.id) return;
          lead.assigneeId = "";
          lead.assigneeName = "";
          lead.updatedAt = now;
          lead.updatedById = actor.id;
          lead.updatedByName = actor.name;
          unassignedLeads += 1;
        });
        data.leads = leads;
        return {
          result: json(200, { ok: true, removedUserId: target.id, unassignedLeads })
        };
      });
    }

    if (pathname === "/api/admin/stats" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      if (!canViewStats(actor)) return json(403, { error: "FORBIDDEN_STATS" });
      const today = dayKey();
      const todayEntry = normDayEntry(state.data.visits.byDay[today]);
      const engagement = normEngData(state.data.engagement);
      const secrets = normSecrets(state.data.secrets);
      const leads = Array.isArray(state.data.leads) ? state.data.leads.map((lead) => normLead(lead)) : [];
      return json(200, {
        totalHits: state.data.visits.totalHits,
        uniqueVisitors: state.data.visits.uniqueVisitors,
        today: { date: today, hits: todayEntry.hits, uniqueVisitors: todayEntry.uniqueVisitors },
        todayUniqueVisitors: todayEntry.uniqueVisitors,
        todayRepeatVisits: Math.max(0, todayEntry.hits - todayEntry.uniqueVisitors),
        last7Days: lastDays(state.data.visits.byDay, 7),
        leadsTotal: leads.length,
        leadsNew: leads.filter((lead) => lead.status === "new").length,
        leadsUnassigned: leads.filter((lead) => !lead.assigneeId).length,
        avgViewMs:
          engagement.samplesCount > 0 ? Math.round(engagement.totalDurationMs / engagement.samplesCount) : 0,
        secretFindsTotal: secrets.totalEvents,
        avgSecretsPerVisitor: 0,
        secretHunters: 0
      });
    }

    if (pathname === "/api/admin/leads" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      const rawLimit = Number(url.searchParams.get("limit"));
      const rawOffset = Number(url.searchParams.get("offset"));
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 5000) : 250;
      const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
      const leads = (Array.isArray(state.data.leads) ? state.data.leads : [])
        .map((lead) => normLead(lead))
        .filter((lead) => canReadLead(actor, lead));
      return json(200, {
        leads: leads.slice(offset, offset + limit),
        total: leads.length,
        offset,
        limit,
        actor,
        permissions: rolePerms(actor.role)
      });
    }

    if (pathname.startsWith("/api/admin/leads/") && method === "PATCH") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const id = decodePath(pathname.replace("/api/admin/leads/", ""));
      if (!id) return json(400, { error: "LEAD_ID_REQUIRED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
      const hasDepartment = Object.prototype.hasOwnProperty.call(body, "department");
      const hasAssigneeId = Object.prototype.hasOwnProperty.call(body, "assigneeId");
      const hasPriority = Object.prototype.hasOwnProperty.call(body, "priority");
      const hasInternalNote = Object.prototype.hasOwnProperty.call(body, "internalNote");
      if (!hasStatus && !hasDepartment && !hasAssigneeId && !hasPriority && !hasInternalNote) {
        return json(400, { error: "NO_UPDATABLE_FIELDS" });
      }
      const nextStatus = hasStatus ? clean(body.status, 30) : "";
      const nextDepartment = hasDepartment ? normDept(body.department) : "";
      const nextAssigneeId = hasAssigneeId ? normUid(body.assigneeId, "") : "";
      const nextPriority = hasPriority ? clean(body.priority, 20) : "";
      const nextInternalNote = hasInternalNote ? clean(body.internalNote, 2000) : "";
      if (hasStatus && !LEAD_STATUSES.has(nextStatus)) return json(400, { error: "INVALID_STATUS" });
      if (hasPriority && !LEAD_PRIORITIES.has(nextPriority)) return json(400, { error: "INVALID_PRIORITY" });
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const index = data.leads.findIndex((item) => normLead(item).id === id);
        if (index < 0) return { noWrite: true, result: json(404, { error: "LEAD_NOT_FOUND" }) };
        const lead = normLead(data.leads[index]);
        if (!canReadLead(actor, lead)) return { noWrite: true, result: json(403, { error: "FORBIDDEN" }) };
        let changed = false;
        if (hasStatus) {
          if (!canUpdateStatus(actor, lead)) {
            return { noWrite: true, result: json(403, { error: "FORBIDDEN_STATUS" }) };
          }
          if (lead.status !== nextStatus) {
            lead.status = nextStatus;
            changed = true;
          }
        }
        if (hasPriority) {
          if (!canAssign(actor)) return { noWrite: true, result: json(403, { error: "FORBIDDEN_PRIORITY" }) };
          if (lead.priority !== nextPriority) {
            lead.priority = nextPriority;
            changed = true;
          }
        }
        if (hasInternalNote) {
          if ((actor.role === ROLE_WORKER || actor.role === ROLE_HELP) && lead.assigneeId !== actor.id) {
            return { noWrite: true, result: json(403, { error: "FORBIDDEN_NOTE" }) };
          }
          if (lead.internalNote !== nextInternalNote) {
            lead.internalNote = nextInternalNote;
            changed = true;
          }
        }
        if (hasDepartment || hasAssigneeId) {
          if (!canAssign(actor)) {
            return { noWrite: true, result: json(403, { error: "FORBIDDEN_ASSIGNMENT" }) };
          }
          let targetDept = hasDepartment ? nextDepartment : lead.department;
          let targetAssigneeId = hasAssigneeId ? nextAssigneeId : lead.assigneeId;
          let targetAssigneeName = lead.assigneeName;
          if (hasAssigneeId) {
            if (!targetAssigneeId) {
              targetAssigneeName = "";
            } else {
              const assignee = ctx.byId.get(targetAssigneeId);
              if (!assignee) return { noWrite: true, result: json(400, { error: "ASSIGNEE_NOT_FOUND" }) };
              if (!canAssignTargetUser(actor, assignee)) {
                return { noWrite: true, result: json(403, { error: "FORBIDDEN_ASSIGNEE" }) };
              }
              targetAssigneeName = assignee.name;
              if (!hasDepartment || assignee.department !== targetDept) targetDept = assignee.department;
            }
          }
          if (!canManageTargetDept(actor, targetDept)) {
            return { noWrite: true, result: json(403, { error: "FORBIDDEN_DEPARTMENT" }) };
          }
          if (lead.department !== targetDept) {
            lead.department = targetDept;
            changed = true;
          }
          if (lead.assigneeId !== targetAssigneeId) {
            lead.assigneeId = targetAssigneeId;
            changed = true;
          }
          if (lead.assigneeName !== targetAssigneeName) {
            lead.assigneeName = targetAssigneeName;
            changed = true;
          }
        }
        if (changed) {
          lead.updatedAt = new Date().toISOString();
          lead.updatedById = actor.id;
          lead.updatedByName = actor.name;
          data.leads[index] = lead;
        }
        return { result: json(200, { ok: true, lead }) };
      });
    }

    return json(404, { error: "API_ROUTE_NOT_FOUND" });
  } catch (error) {
    const message = String(error?.message || "");
    console.error("API error:", error);

    // Expose the exact error only in debug mode, to avoid leaking internals by default.
    if (debug && message) {
      const stack = String(error?.stack || "")
        .split("\n")
        .slice(0, 10)
        .join("\n")
        .trim();
      const bindingKeys = env && typeof env === "object" ? Object.keys(env) : [];
      return json(500, { error: message, stack, bindings: bindingKeys });
    }

    return json(500, { error: "INTERNAL_SERVER_ERROR", hint: "Open /api/health?debug=1 to inspect the error." });
  }
}
