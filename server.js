const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(ROOT_DIR, String(process.env.DATA_DIR))
  : path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "site-data.json");
const ADMIN_USERS_FILE = path.join(DATA_DIR, "admin-users.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "change-me-secret";
const ADMIN_AUTH_DISABLED = !["0", "false", "off"].includes(
  String(process.env.ADMIN_AUTH_DISABLED || "")
    .trim()
    .toLowerCase()
);
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

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

const MAX_BODY_SIZE = 1024 * 1024;
let dataLock = Promise.resolve();
let ADMIN_USERS = [];
let ADMIN_USERS_BY_ID = new Map();
let ADMIN_USERS_BY_USERNAME = new Map();

function createInitialData() {
  return {
    visits: {
      totalHits: 0,
      uniqueVisitors: 0,
      knownVisitors: {},
      byDay: {}
    },
    engagement: {
      totalDurationMs: 0,
      samplesCount: 0,
      byPage: {}
    },
    secrets: {
      totalEvents: 0,
      bySecret: {},
      byVisitor: {}
    },
    leads: []
  };
}

function normalizeDayEntry(input) {
  const entry = input && typeof input === "object" ? input : {};
  const visitors = entry.visitors && typeof entry.visitors === "object" ? entry.visitors : {};

  return {
    hits: Number.isFinite(Number(entry.hits)) ? Number(entry.hits) : 0,
    uniqueVisitors: Number.isFinite(Number(entry.uniqueVisitors)) ? Number(entry.uniqueVisitors) : 0,
    visitors
  };
}

function normalizeEngagementEntry(input) {
  const entry = input && typeof input === "object" ? input : {};
  return {
    durationMs: Number.isFinite(Number(entry.durationMs)) ? Math.max(0, Number(entry.durationMs)) : 0,
    samples: Number.isFinite(Number(entry.samples)) ? Math.max(0, Number(entry.samples)) : 0
  };
}

function normalizeEngagementData(input) {
  const source = input && typeof input === "object" ? input : {};
  const byPageInput = source.byPage && typeof source.byPage === "object" ? source.byPage : {};
  const byPage = {};

  for (const [page, entry] of Object.entries(byPageInput)) {
    byPage[page] = normalizeEngagementEntry(entry);
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

function normalizeSecretVisitorEntry(input) {
  const entry = input && typeof input === "object" ? input : {};
  const uniqueSecretsInput =
    entry.uniqueSecrets && typeof entry.uniqueSecrets === "object" ? entry.uniqueSecrets : {};
  const uniqueSecrets = {};

  for (const secret of Object.keys(uniqueSecretsInput)) {
    uniqueSecrets[secret] = true;
  }

  return {
    totalEvents: Number.isFinite(Number(entry.totalEvents)) ? Math.max(0, Number(entry.totalEvents)) : 0,
    uniqueSecrets
  };
}

function normalizeSecretsData(input) {
  const source = input && typeof input === "object" ? input : {};
  const bySecretInput = source.bySecret && typeof source.bySecret === "object" ? source.bySecret : {};
  const byVisitorInput = source.byVisitor && typeof source.byVisitor === "object" ? source.byVisitor : {};
  const bySecret = {};
  const byVisitor = {};

  for (const [secret, count] of Object.entries(bySecretInput)) {
    bySecret[secret] = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  }

  for (const [visitorId, entry] of Object.entries(byVisitorInput)) {
    byVisitor[visitorId] = normalizeSecretVisitorEntry(entry);
  }

  return {
    totalEvents: Number.isFinite(Number(source.totalEvents)) ? Math.max(0, Number(source.totalEvents)) : 0,
    bySecret,
    byVisitor
  };
}

function normalizeData(raw) {
  const base = raw && typeof raw === "object" ? raw : {};
  const visitsInput = base.visits && typeof base.visits === "object" ? base.visits : {};
  const byDayInput = visitsInput.byDay && typeof visitsInput.byDay === "object" ? visitsInput.byDay : {};
  const byDay = {};

  for (const [date, entry] of Object.entries(byDayInput)) {
    byDay[date] = normalizeDayEntry(entry);
  }

  return {
    visits: {
      totalHits: Number.isFinite(Number(visitsInput.totalHits)) ? Number(visitsInput.totalHits) : 0,
      uniqueVisitors: Number.isFinite(Number(visitsInput.uniqueVisitors)) ? Number(visitsInput.uniqueVisitors) : 0,
      knownVisitors: visitsInput.knownVisitors && typeof visitsInput.knownVisitors === "object" ? visitsInput.knownVisitors : {},
      byDay
    },
    engagement: normalizeEngagementData(base.engagement),
    secrets: normalizeSecretsData(base.secrets),
    leads: Array.isArray(base.leads) ? base.leads.map((lead) => normalizeLead(lead)) : []
  };
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(createInitialData(), null, 2), "utf8");
  }
}

async function loadData() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const cleanRaw = raw.replace(/^\uFEFF/, "");
  const parsed = cleanRaw ? JSON.parse(cleanRaw) : createInitialData();
  return normalizeData(parsed);
}

function withDataLock(mutator) {
  const run = dataLock.then(async () => {
    const data = await loadData();
    const result = await mutator(data);
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return result;
  });

  dataLock = run.catch(() => undefined);
  return run;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;

    req.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BODY_SIZE) {
        reject(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        const parsed = raw ? JSON.parse(raw) : {};
        resolve(parsed && typeof parsed === "object" ? parsed : {});
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });

    req.on("error", reject);
  });
}

function sanitizeText(value, maxLength) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeRole(value) {
  const role = sanitizeText(value, 30).toLowerCase();
  return ADMIN_ROLES.has(role) ? role : ROLE_HELP;
}

function normalizeDepartment(value) {
  const department = sanitizeText(value, 80).toLowerCase();
  return department || DEFAULT_DEPARTMENT;
}

function normalizeUserId(value, fallback = "user") {
  const normalized = sanitizeText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function normalizeLeadStatus(value) {
  const status = sanitizeText(value, 30);
  return LEAD_STATUSES.has(status) ? status : "new";
}

function normalizeLeadPriority(value) {
  const priority = sanitizeText(value, 20);
  return LEAD_PRIORITIES.has(priority) ? priority : "normal";
}

function normalizeLead(input) {
  const source = input && typeof input === "object" ? input : {};
  const fallbackSeed = sanitizeText(source.createdAt, 64) || sanitizeText(source.name, 40) || "legacy";
  const fallbackId = `lead_legacy_${Buffer.from(fallbackSeed).toString("base64url").slice(0, 12)}`;
  const id = sanitizeText(source.id, 120) || fallbackId;

  return {
    id,
    name: sanitizeText(source.name, 120),
    contact: sanitizeText(source.contact, 140),
    type: sanitizeText(source.type, 80),
    message: sanitizeText(source.message, 2000),
    sourcePage: sanitizeText(source.sourcePage, 120) || "contact.html",
    status: normalizeLeadStatus(source.status),
    department: normalizeDepartment(source.department || DEFAULT_DEPARTMENT),
    assigneeId: normalizeUserId(source.assigneeId, ""),
    assigneeName: sanitizeText(source.assigneeName, 120),
    priority: normalizeLeadPriority(source.priority),
    internalNote: sanitizeText(source.internalNote, 2000),
    updatedById: normalizeUserId(source.updatedById, ""),
    updatedByName: sanitizeText(source.updatedByName, 120),
    createdAt: sanitizeText(source.createdAt, 64) || new Date().toISOString(),
    updatedAt: sanitizeText(source.updatedAt, 64) || new Date().toISOString()
  };
}

function toPublicAdminUser(user) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    department: user.department
  };
}

function getRolePermissions(role) {
  return {
    canViewStats: role === ROLE_OWNER,
    canAssignLeads: role === ROLE_OWNER || role === ROLE_MANAGER,
    canViewAllLeads: role === ROLE_OWNER
  };
}

function createDefaultAdminUsers() {
  return [
    {
      id: "owner",
      username: "admin",
      password: ADMIN_PASSWORD,
      name: "Owner",
      role: ROLE_OWNER,
      department: "management"
    },
    {
      id: "sales_help",
      username: process.env.SALES_HELP_LOGIN || "sales_help",
      password: process.env.SALES_HELP_PASSWORD || "change-sales-help",
      name: "Sales Help",
      role: ROLE_HELP,
      department: "sales"
    },
    {
      id: "production_help",
      username: process.env.PRODUCTION_HELP_LOGIN || "production_help",
      password: process.env.PRODUCTION_HELP_PASSWORD || "change-production-help",
      name: "Production Help",
      role: ROLE_HELP,
      department: "production"
    }
  ];
}

function normalizeAdminUser(raw, index) {
  const source = raw && typeof raw === "object" ? raw : {};
  const id = normalizeUserId(source.id, `user_${index + 1}`);
  const username = normalizeUserId(source.username, id);
  const password = String(source.password || "").trim();
  const name = sanitizeText(source.name, 120) || username;
  const role = normalizeRole(source.role);
  const department = normalizeDepartment(source.department);

  if (!password) {
    return null;
  }

  return {
    id,
    username,
    password,
    name,
    role,
    department
  };
}

function readStoredAdminUsersSync() {
  try {
    const raw = fsSync.readFileSync(ADMIN_USERS_FILE, "utf8").replace(/^\uFEFF/, "");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getPersistedAdminUsers() {
  return ADMIN_USERS.filter((user) => !CORE_USER_IDS.has(user.id) && user.role !== ROLE_OWNER).map((user) => ({
    id: user.id,
    username: user.username,
    password: user.password,
    name: user.name,
    role: user.role,
    department: user.department
  }));
}

async function persistCustomAdminUsers() {
  const users = getPersistedAdminUsers();
  await fs.mkdir(DATA_DIR, { recursive: true });

  if (users.length === 0) {
    try {
      await fs.unlink(ADMIN_USERS_FILE);
    } catch {
      // Ignore if file does not exist.
    }
    return;
  }

  await fs.writeFile(ADMIN_USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

function createAdminUsers() {
  const rawConfig = String(process.env.ADMIN_USERS_JSON || "").trim();
  let usersFromEnv = [];

  if (rawConfig) {
    try {
      const parsed = JSON.parse(rawConfig);
      if (Array.isArray(parsed)) {
        usersFromEnv = parsed;
      }
    } catch (error) {
      console.error("ADMIN_USERS_JSON parse failed, fallback to default users:", error.message);
    }
  }

  const storedUsers = usersFromEnv.length > 0 ? [] : readStoredAdminUsersSync();
  const rawUsers = usersFromEnv.length > 0 ? usersFromEnv : [...createDefaultAdminUsers(), ...storedUsers];
  const users = [];
  const knownIds = new Set();
  const knownUsernames = new Set();

  rawUsers.forEach((rawUser, index) => {
    const user = normalizeAdminUser(rawUser, index);
    if (!user) {
      return;
    }
    if (knownIds.has(user.id) || knownUsernames.has(user.username)) {
      return;
    }

    knownIds.add(user.id);
    knownUsernames.add(user.username);
    users.push(user);
  });

  if (users.length === 0) {
    users.push({
      id: "owner",
      username: "admin",
      password: ADMIN_PASSWORD,
      name: "Owner",
      role: ROLE_OWNER,
      department: "management"
    });
  }

  return users;
}

function initializeAdminUsers() {
  ADMIN_USERS = createAdminUsers();
  ADMIN_USERS_BY_ID = new Map();
  ADMIN_USERS_BY_USERNAME = new Map();

  ADMIN_USERS.forEach((user) => {
    ADMIN_USERS_BY_ID.set(user.id, user);
    ADMIN_USERS_BY_USERNAME.set(user.username, user);
  });
}

function resolveActorFromPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const payloadUserId = normalizeUserId(payload.userId, "");
  if (payloadUserId) {
    const user = ADMIN_USERS_BY_ID.get(payloadUserId);
    if (user) {
      return toPublicAdminUser(user);
    }
  }

  if (payload.role === "admin") {
    const owner = ADMIN_USERS.find((user) => user.role === ROLE_OWNER) || ADMIN_USERS[0];
    return owner ? toPublicAdminUser(owner) : null;
  }

  return null;
}

function canViewStats(actor) {
  return Boolean(actor && actor.role === ROLE_OWNER);
}

function canReadLead(actor, lead) {
  if (!actor || !lead) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_MANAGER) {
    return (
      lead.department === actor.department ||
      lead.department === DEFAULT_DEPARTMENT ||
      lead.assigneeId === actor.id
    );
  }

  return lead.assigneeId === actor.id;
}

function canAssignLeads(actor) {
  return Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_MANAGER));
}

function canManageUsers(actor) {
  return Boolean(actor && actor.role === ROLE_OWNER);
}

function canManageTargetDepartment(actor, targetDepartment) {
  if (!actor) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_MANAGER) {
    return targetDepartment === actor.department;
  }

  return false;
}

function canAssignTargetUser(actor, targetUser) {
  if (!actor || !targetUser) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_MANAGER) {
    return targetUser.department === actor.department;
  }

  return false;
}

function canUpdateLeadStatus(actor, lead) {
  if (!actor || !lead) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_MANAGER) {
    return canReadLead(actor, lead);
  }

  return lead.assigneeId === actor.id;
}

function getVisibleUsers(actor) {
  if (!actor) {
    return [];
  }

  if (actor.role === ROLE_OWNER) {
    return ADMIN_USERS.map((user) => toPublicAdminUser(user));
  }

  if (actor.role === ROLE_MANAGER) {
    return ADMIN_USERS.filter((user) => user.department === actor.department).map((user) =>
      toPublicAdminUser(user)
    );
  }

  const self = ADMIN_USERS_BY_ID.get(actor.id);
  return self ? [toPublicAdminUser(self)] : [];
}

function collectKnownDepartments(data) {
  const departments = new Set();
  departments.add(DEFAULT_DEPARTMENT);

  ADMIN_USERS.forEach((user) => {
    if (user.department) {
      departments.add(user.department);
    }
  });

  const leads = Array.isArray(data?.leads) ? data.leads : [];
  leads.forEach((leadInput) => {
    const lead = normalizeLead(leadInput);
    if (lead.department) {
      departments.add(lead.department);
    }
  });

  return Array.from(departments);
}

function getVisibleDepartments(actor, data) {
  const allDepartments = collectKnownDepartments(data);
  if (!actor) {
    return [DEFAULT_DEPARTMENT];
  }

  if (actor.role === ROLE_OWNER) {
    return allDepartments;
  }

  return [actor.department];
}

initializeAdminUsers();

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", TOKEN_SECRET)
    .update(encoded)
    .digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (!payload.exp || Date.now() > Number(payload.exp)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    return null;
  }

  return token;
}

function requireAdmin(req, res) {
  const token = getBearerToken(req);
  const payload = verifyToken(token);

  if (!payload) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return null;
  }

  const actor = resolveActorFromPayload(payload);
  if (!actor) {
    sendJson(res, 401, { error: "UNAUTHORIZED" });
    return null;
  }

  return actor;
}

function getWorkspaceFallbackActor() {
  if (!ADMIN_AUTH_DISABLED) {
    return null;
  }

  const owner =
    ADMIN_USERS.find((user) => user && user.role === ROLE_OWNER) ||
    ADMIN_USERS[0];
  if (!owner) {
    return null;
  }

  // Stable actor used when auth is disabled (no passwords/logins in Workspace).
  return {
    id: "workspace",
    username: owner.username,
    name: "Workspace",
    role: ROLE_OWNER,
    department: owner.department || "management"
  };
}

function getOptionalAdmin(req) {
  const token = getBearerToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    return getWorkspaceFallbackActor();
  }

  return resolveActorFromPayload(payload);
}

function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function collectLastDays(byDay, count) {
  const days = [];
  const now = new Date();

  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - index);
    const key = getDayKey(date);
    const dayEntry = normalizeDayEntry(byDay[key]);
    days.push({
      date: key,
      hits: dayEntry.hits,
      uniqueVisitors: dayEntry.uniqueVisitors
    });
  }

  return days;
}

async function handleApi(req, res, urlObject) {
  const { pathname } = urlObject;

  if (pathname === "/api/health" && req.method === "GET") {
    sendJson(res, 200, { ok: true, time: new Date().toISOString() });
    return;
  }

  if (pathname === "/api/visit" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const visitorId = sanitizeText(body.visitorId, 120);
    const page = sanitizeText(body.path, 180);
    const referrer = sanitizeText(body.referrer, 220);
    const userAgent = sanitizeText(body.userAgent, 300);
    const today = getDayKey();

    await withDataLock((data) => {
      const dayEntry = normalizeDayEntry(data.visits.byDay[today]);

      data.visits.totalHits += 1;
      dayEntry.hits += 1;

      if (visitorId && !dayEntry.visitors[visitorId]) {
        dayEntry.visitors[visitorId] = 1;
        dayEntry.uniqueVisitors += 1;
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

      data.visits.byDay[today] = dayEntry;
      return null;
    });

    sendJson(res, 201, { ok: true });
    return;
  }

  if (pathname === "/api/engagement" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const visitorId = sanitizeText(body.visitorId, 120);
    const page = sanitizeText(body.path, 180);
    const rawDurationMs = Number(body.durationMs);

    if (!Number.isFinite(rawDurationMs) || rawDurationMs < 0) {
      sendJson(res, 400, { error: "INVALID_DURATION" });
      return;
    }

    const durationMs = Math.min(Math.round(rawDurationMs), 1000 * 60 * 60 * 4);

    if (durationMs <= 0) {
      sendJson(res, 201, { ok: true });
      return;
    }

    await withDataLock((data) => {
      const engagement = normalizeEngagementData(data.engagement);
      const pageKey = page || "unknown";
      const pageEntry = normalizeEngagementEntry(engagement.byPage[pageKey]);

      engagement.totalDurationMs += durationMs;
      engagement.samplesCount += 1;
      pageEntry.durationMs += durationMs;
      pageEntry.samples += 1;
      engagement.byPage[pageKey] = pageEntry;
      data.engagement = engagement;

      if (visitorId && data.visits.knownVisitors[visitorId]) {
        data.visits.knownVisitors[visitorId].lastSeen = new Date().toISOString();
      }

      return null;
    });

    sendJson(res, 201, { ok: true });
    return;
  }

  if (pathname === "/api/secret" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const visitorId = sanitizeText(body.visitorId, 120);
    const page = sanitizeText(body.path, 180);
    const secret = sanitizeText(body.secret, 80).toLowerCase();

    if (!secret) {
      sendJson(res, 400, { error: "SECRET_REQUIRED" });
      return;
    }

    await withDataLock((data) => {
      const secrets = normalizeSecretsData(data.secrets);
      secrets.totalEvents += 1;
      secrets.bySecret[secret] = (Number(secrets.bySecret[secret]) || 0) + 1;

      if (visitorId) {
        const visitorEntry = normalizeSecretVisitorEntry(secrets.byVisitor[visitorId]);
        visitorEntry.totalEvents += 1;
        visitorEntry.uniqueSecrets[secret] = true;
        secrets.byVisitor[visitorId] = visitorEntry;
      }

      data.secrets = secrets;

      if (visitorId && page && data.visits.knownVisitors[visitorId]) {
        data.visits.knownVisitors[visitorId].lastSecretPage = page;
      }

      return null;
    });

    sendJson(res, 201, { ok: true });
    return;
  }

  if (pathname === "/api/leads" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const name = sanitizeText(body.name, 120);
    const contact = sanitizeText(body.contact, 140);
    const type = sanitizeText(body.type, 80);
    const message = sanitizeText(body.message, 2000);
    const sourcePage = sanitizeText(body.sourcePage, 120);

    if (!name || !contact || !type) {
      sendJson(res, 400, { error: "NAME_CONTACT_TYPE_REQUIRED" });
      return;
    }

    const lead = {
      id: `lead_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`,
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

    await withDataLock((data) => {
      data.leads.unshift(lead);
      if (data.leads.length > 5000) {
        data.leads.length = 5000;
      }
      return null;
    });

    sendJson(res, 201, { ok: true, leadId: lead.id });
    return;
  }

  if (pathname === "/api/admin/login" && req.method === "POST") {
    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const username = normalizeUserId(body.username, "");
    const password = String(body.password || "").trim().slice(0, 200);

    if (!username || !password) {
      sendJson(res, 401, { error: "INVALID_CREDENTIALS" });
      return;
    }

    let user = null;
    const byUsername = ADMIN_USERS_BY_USERNAME.get(username);
    if (byUsername && byUsername.password === password) {
      user = byUsername;
    }

    if (!user) {
      sendJson(res, 401, { error: "INVALID_CREDENTIALS" });
      return;
    }

    const actor = toPublicAdminUser(user);
    const permissions = getRolePermissions(actor.role);

    const token = signToken({
      userId: actor.id,
      role: actor.role,
      department: actor.department,
      exp: Date.now() + TOKEN_TTL_MS
    });

    sendJson(res, 200, {
      ok: true,
      token,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
      actor,
      permissions
    });
    return;
  }

  if (pathname === "/api/admin/me" && req.method === "GET") {
    const actor = requireAdmin(req, res);
    if (!actor) {
      return;
    }

    sendJson(res, 200, {
      ok: true,
      actor,
      permissions: getRolePermissions(actor.role)
    });
    return;
  }

  if (pathname === "/api/admin/team" && req.method === "GET") {
    const actor = getOptionalAdmin(req);
    const data = await loadData();
    const permissions = actor
      ? getRolePermissions(actor.role)
      : {
          canViewStats: false,
          canAssignLeads: false,
          canViewAllLeads: true
        };

    sendJson(res, 200, {
      ok: true,
      actor,
      permissions,
      users: actor ? getVisibleUsers(actor) : [],
      departments: actor ? getVisibleDepartments(actor, data) : collectKnownDepartments(data)
    });
    return;
  }

  if (pathname === "/api/admin/users" && req.method === "GET") {
    const actor = requireAdmin(req, res);
    if (!actor) {
      return;
    }

    if (!canManageUsers(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_USERS" });
      return;
    }

    sendJson(res, 200, {
      ok: true,
      users: ADMIN_USERS.map((user) => toPublicAdminUser(user))
    });
    return;
  }

  if (pathname === "/api/admin/users" && req.method === "POST") {
    const actor = requireAdmin(req, res);
    if (!actor) {
      return;
    }

    if (!canManageUsers(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_USERS" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const username = normalizeUserId(body.username, "");
    const password = String(body.password || "").trim().slice(0, 200);
    const name = sanitizeText(body.name, 120) || username;
    const department = normalizeDepartment(body.department);

    if (!username || !password) {
      sendJson(res, 400, { error: "USERNAME_PASSWORD_REQUIRED" });
      return;
    }

    if (ADMIN_USERS_BY_USERNAME.has(username)) {
      sendJson(res, 400, { error: "USERNAME_TAKEN" });
      return;
    }

    const requestedId = normalizeUserId(body.id, `help_${username}`);
    let id = requestedId;
    let suffix = 1;
    while (ADMIN_USERS_BY_ID.has(id)) {
      id = `${requestedId}_${suffix}`;
      suffix += 1;
    }

    const user = {
      id,
      username,
      password,
      name,
      role: ROLE_HELP,
      department
    };

    ADMIN_USERS.push(user);
    ADMIN_USERS_BY_ID.set(user.id, user);
    ADMIN_USERS_BY_USERNAME.set(user.username, user);
    await persistCustomAdminUsers();

    sendJson(res, 201, {
      ok: true,
      user: toPublicAdminUser(user)
    });
    return;
  }

  if (pathname.startsWith("/api/admin/users/") && req.method === "PATCH") {
    const actor = requireAdmin(req, res);
    if (!actor) {
      return;
    }

    if (!canManageUsers(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_USERS" });
      return;
    }

    const id = decodeURIComponent(pathname.replace("/api/admin/users/", ""));
    if (!id) {
      sendJson(res, 400, { error: "USER_ID_REQUIRED" });
      return;
    }

    const targetUser = ADMIN_USERS_BY_ID.get(id);
    if (!targetUser) {
      sendJson(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    if (targetUser.role === ROLE_OWNER) {
      sendJson(res, 403, { error: "FORBIDDEN_OWNER_EDIT" });
      return;
    }

    if (CORE_USER_IDS.has(targetUser.id)) {
      sendJson(res, 403, { error: "FORBIDDEN_SYSTEM_USER" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const hasUsername = Object.prototype.hasOwnProperty.call(body, "username");
    const hasPassword = Object.prototype.hasOwnProperty.call(body, "password");
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const hasDepartment = Object.prototype.hasOwnProperty.call(body, "department");

    if (!hasUsername && !hasPassword && !hasName && !hasDepartment) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const nextUsername = hasUsername ? normalizeUserId(body.username, "") : targetUser.username;
    const nextPassword = hasPassword ? String(body.password || "").trim().slice(0, 200) : targetUser.password;
    const nextName = hasName ? sanitizeText(body.name, 120) || targetUser.name : targetUser.name;
    const nextDepartment = hasDepartment ? normalizeDepartment(body.department) : targetUser.department;

    if (hasUsername && !nextUsername) {
      sendJson(res, 400, { error: "INVALID_USERNAME" });
      return;
    }

    if (hasPassword && !nextPassword) {
      sendJson(res, 400, { error: "INVALID_PASSWORD" });
      return;
    }

    if (nextUsername !== targetUser.username) {
      const existing = ADMIN_USERS_BY_USERNAME.get(nextUsername);
      if (existing && existing.id !== targetUser.id) {
        sendJson(res, 400, { error: "USERNAME_TAKEN" });
        return;
      }
      ADMIN_USERS_BY_USERNAME.delete(targetUser.username);
      targetUser.username = nextUsername;
      ADMIN_USERS_BY_USERNAME.set(targetUser.username, targetUser);
    }

    targetUser.password = nextPassword;
    targetUser.name = nextName;
    targetUser.department = nextDepartment;
    await persistCustomAdminUsers();

    sendJson(res, 200, {
      ok: true,
      user: toPublicAdminUser(targetUser)
    });
    return;
  }

  if (pathname.startsWith("/api/admin/users/") && req.method === "DELETE") {
    const actor = requireAdmin(req, res);
    if (!actor) {
      return;
    }

    if (!canManageUsers(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_USERS" });
      return;
    }

    const id = decodeURIComponent(pathname.replace("/api/admin/users/", ""));
    if (!id) {
      sendJson(res, 400, { error: "USER_ID_REQUIRED" });
      return;
    }

    const targetUser = ADMIN_USERS_BY_ID.get(id);
    if (!targetUser) {
      sendJson(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    if (targetUser.role === ROLE_OWNER) {
      sendJson(res, 403, { error: "FORBIDDEN_OWNER_EDIT" });
      return;
    }

    if (CORE_USER_IDS.has(targetUser.id)) {
      sendJson(res, 403, { error: "FORBIDDEN_SYSTEM_USER" });
      return;
    }

    const index = ADMIN_USERS.findIndex((user) => user.id === targetUser.id);
    if (index < 0) {
      sendJson(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    ADMIN_USERS.splice(index, 1);
    ADMIN_USERS_BY_ID.delete(targetUser.id);
    ADMIN_USERS_BY_USERNAME.delete(targetUser.username);
    await persistCustomAdminUsers();

    const unassignedLeads = await withDataLock((data) => {
      const leads = Array.isArray(data.leads) ? data.leads.map((item) => normalizeLead(item)) : [];
      let changedCount = 0;
      const now = new Date().toISOString();

      leads.forEach((lead) => {
        if (lead.assigneeId !== targetUser.id) {
          return;
        }

        lead.assigneeId = "";
        lead.assigneeName = "";
        lead.updatedAt = now;
        lead.updatedById = actor.id;
        lead.updatedByName = actor.name;
        changedCount += 1;
      });

      data.leads = leads;
      return changedCount;
    });

    sendJson(res, 200, {
      ok: true,
      removedUserId: targetUser.id,
      unassignedLeads
    });
    return;
  }

  if (pathname === "/api/admin/stats" && req.method === "GET") {
    const stats = await withDataLock((data) => {
      const todayKey = getDayKey();
      const todayEntry = normalizeDayEntry(data.visits.byDay[todayKey]);
      const engagement = normalizeEngagementData(data.engagement);
      const secrets = normalizeSecretsData(data.secrets);
      const last7Days = collectLastDays(data.visits.byDay, 7);
      const normalizedLeads = Array.isArray(data.leads) ? data.leads.map((lead) => normalizeLead(lead)) : [];
      data.leads = normalizedLeads;
      const leadsNew = normalizedLeads.filter((lead) => lead.status === "new").length;
      const leadsUnassigned = normalizedLeads.filter((lead) => !lead.assigneeId).length;
      const avgViewMs =
        engagement.samplesCount > 0
          ? Math.round(engagement.totalDurationMs / engagement.samplesCount)
          : 0;
      const todayRepeatVisits = Math.max(0, todayEntry.hits - todayEntry.uniqueVisitors);

      return {
        totalHits: data.visits.totalHits,
        uniqueVisitors: data.visits.uniqueVisitors,
        today: {
          date: todayKey,
          hits: todayEntry.hits,
          uniqueVisitors: todayEntry.uniqueVisitors
        },
        todayUniqueVisitors: todayEntry.uniqueVisitors,
        todayRepeatVisits,
        last7Days,
        leadsTotal: normalizedLeads.length,
        leadsNew,
        leadsUnassigned,
        avgViewMs,
        secretFindsTotal: secrets.totalEvents,
        avgSecretsPerVisitor: 0,
        secretHunters: 0
      };
    });

    sendJson(res, 200, stats);
    return;
  }

  if (pathname === "/api/admin/leads" && req.method === "GET") {
    const actor = getOptionalAdmin(req);

    const rawLimit = Number(urlObject.searchParams.get("limit"));
    const rawOffset = Number(urlObject.searchParams.get("offset"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 5000)
        : 250;
    const offset =
      Number.isFinite(rawOffset) && rawOffset >= 0
        ? Math.floor(rawOffset)
        : 0;

    const payload = await withDataLock((data) => {
      const normalizedLeads = Array.isArray(data.leads) ? data.leads.map((lead) => normalizeLead(lead)) : [];
      data.leads = normalizedLeads;
      const visibleLeads = actor
        ? normalizedLeads.filter((lead) => canReadLead(actor, lead))
        : normalizedLeads;
      const total = visibleLeads.length;
      const leads = visibleLeads.slice(offset, offset + limit);
      return {
        leads,
        total,
        offset,
        limit,
        actor,
        permissions: actor
          ? getRolePermissions(actor.role)
          : {
              canViewStats: false,
              canAssignLeads: false,
              canViewAllLeads: true
            }
      };
    });
    sendJson(res, 200, payload);
    return;
  }

  if (pathname.startsWith("/api/admin/leads/") && req.method === "PATCH") {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    const id = decodeURIComponent(pathname.replace("/api/admin/leads/", ""));
    if (!id) {
      sendJson(res, 400, { error: "LEAD_ID_REQUIRED" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasDepartment = Object.prototype.hasOwnProperty.call(body, "department");
    const hasAssigneeId = Object.prototype.hasOwnProperty.call(body, "assigneeId");
    const hasPriority = Object.prototype.hasOwnProperty.call(body, "priority");
    const hasInternalNote = Object.prototype.hasOwnProperty.call(body, "internalNote");

    if (!hasStatus && !hasDepartment && !hasAssigneeId && !hasPriority && !hasInternalNote) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const nextStatus = hasStatus ? sanitizeText(body.status, 30) : "";
    const nextDepartmentRaw = hasDepartment ? normalizeDepartment(body.department) : "";
    const nextAssigneeIdRaw = hasAssigneeId ? normalizeUserId(body.assigneeId, "") : "";
    const nextPriority = hasPriority ? sanitizeText(body.priority, 20) : "";
    const nextInternalNote = hasInternalNote ? sanitizeText(body.internalNote, 2000) : "";

    if (hasStatus && !LEAD_STATUSES.has(nextStatus)) {
      sendJson(res, 400, { error: "INVALID_STATUS" });
      return;
    }

    if (hasPriority && !LEAD_PRIORITIES.has(nextPriority)) {
      sendJson(res, 400, { error: "INVALID_PRIORITY" });
      return;
    }

    const updateResult = await withDataLock((data) => {
      const index = data.leads.findIndex((item) => normalizeLead(item).id === id);
      if (index < 0) {
        return { error: "LEAD_NOT_FOUND" };
      }

      const lead = normalizeLead(data.leads[index]);
      if (!canReadLead(actor, lead)) {
        return { error: "FORBIDDEN" };
      }

      let changed = false;

      if (hasStatus) {
        if (!canUpdateLeadStatus(actor, lead)) {
          return { error: "FORBIDDEN_STATUS" };
        }
        if (lead.status !== nextStatus) {
          lead.status = nextStatus;
          changed = true;
        }
      }

      if (hasPriority) {
        if (!canAssignLeads(actor)) {
          return { error: "FORBIDDEN_PRIORITY" };
        }
        if (lead.priority !== nextPriority) {
          lead.priority = nextPriority;
          changed = true;
        }
      }

      if (hasInternalNote) {
        if ((actor.role === ROLE_WORKER || actor.role === ROLE_HELP) && lead.assigneeId !== actor.id) {
          return { error: "FORBIDDEN_NOTE" };
        }
        if (lead.internalNote !== nextInternalNote) {
          lead.internalNote = nextInternalNote;
          changed = true;
        }
      }

      if (hasDepartment || hasAssigneeId) {
        if (!canAssignLeads(actor)) {
          return { error: "FORBIDDEN_ASSIGNMENT" };
        }

        let targetDepartment = hasDepartment ? nextDepartmentRaw : lead.department;
        let targetAssigneeId = hasAssigneeId ? nextAssigneeIdRaw : lead.assigneeId;
        let targetAssigneeName = lead.assigneeName;

        if (hasAssigneeId) {
          if (!targetAssigneeId) {
            targetAssigneeName = "";
          } else {
            const assigneeUser = ADMIN_USERS_BY_ID.get(targetAssigneeId);
            if (!assigneeUser) {
              return { error: "ASSIGNEE_NOT_FOUND" };
            }
            if (!canAssignTargetUser(actor, assigneeUser)) {
              return { error: "FORBIDDEN_ASSIGNEE" };
            }
            targetAssigneeName = assigneeUser.name;
            if (!hasDepartment || assigneeUser.department !== targetDepartment) {
              targetDepartment = assigneeUser.department;
            }
          }
        }

        if (!canManageTargetDepartment(actor, targetDepartment)) {
          return { error: "FORBIDDEN_DEPARTMENT" };
        }

        if (lead.department !== targetDepartment) {
          lead.department = targetDepartment;
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

      if (!changed) {
        return { ok: true, lead };
      }

      lead.updatedAt = new Date().toISOString();
      lead.updatedById = actor.id;
      lead.updatedByName = actor.name;
      data.leads[index] = lead;
      return { ok: true, lead };
    });

    if (!updateResult || !updateResult.ok) {
      const code = updateResult?.error || "UPDATE_FAILED";
      if (code === "LEAD_NOT_FOUND") {
        sendJson(res, 404, { error: code });
        return;
      }
      if (
        code === "FORBIDDEN" ||
        code === "FORBIDDEN_STATUS" ||
        code === "FORBIDDEN_PRIORITY" ||
        code === "FORBIDDEN_NOTE" ||
        code === "FORBIDDEN_ASSIGNMENT" ||
        code === "FORBIDDEN_ASSIGNEE" ||
        code === "FORBIDDEN_DEPARTMENT"
      ) {
        sendJson(res, 403, { error: code });
        return;
      }
      if (code === "ASSIGNEE_NOT_FOUND") {
        sendJson(res, 400, { error: code });
        return;
      }
      sendJson(res, 400, { error: code });
      return;
    }

    sendJson(res, 200, { ok: true, lead: updateResult.lead });
    return;
  }

  sendJson(res, 404, { error: "API_ROUTE_NOT_FOUND" });
}

async function serveStatic(req, res, urlObject) {
  let pathname = urlObject.pathname;
  if (pathname === "/") {
    pathname = "/index.html";
  } else if (pathname === "/admin") {
    pathname = "/admin.html";
  } else if (pathname === "/admin-leads") {
    pathname = "/admin-leads.html";
  }

  const safePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!safePath.startsWith(ROOT_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(safePath);
    let filePath = safePath;

    if (stats.isDirectory()) {
      filePath = path.join(safePath, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    const content = await fs.readFile(filePath);

    res.writeHead(200, {
      "Content-Type": contentType
    });
    res.end(content);
  } catch {
    sendText(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    sendText(res, 400, "Invalid request");
    return;
  }

  const host = req.headers.host || `localhost:${PORT}`;
  const urlObject = new URL(req.url, `http://${host}`);

  try {
    if (urlObject.pathname.startsWith("/api/")) {
      await handleApi(req, res, urlObject);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method Not Allowed");
      return;
    }

    await serveStatic(req, res, urlObject);
  } catch (error) {
    console.error("Server error:", error);
    sendJson(res, 500, { error: "INTERNAL_SERVER_ERROR" });
  }
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  if (ADMIN_AUTH_DISABLED) {
    console.log("Admin auth: DISABLED (set ADMIN_AUTH_DISABLED=0 to enable).");
    return;
  }

  if (ADMIN_PASSWORD === "change-me") {
    console.log("Warning: set ADMIN_PASSWORD env variable before production use.");
  }

  const weakUsers = ADMIN_USERS.filter((user) => user.password.startsWith("change-"));
  if (weakUsers.length > 0) {
    console.log("Warning: default team passwords detected. Set ADMIN_USERS_JSON or *_PASSWORD env variables.");
  }
});


