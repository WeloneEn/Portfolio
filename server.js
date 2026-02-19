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
const ROLE_PRODUCT = "product";
const ROLE_MANAGER = "manager";
const LEGACY_ROLE_HELP = "help";
const LEGACY_ROLE_WORKER = "worker";
const LEGACY_ROLE_ALIASES = new Set([LEGACY_ROLE_HELP, LEGACY_ROLE_WORKER]);
const ADMIN_ROLES = new Set([ROLE_OWNER, ROLE_PRODUCT, ROLE_MANAGER]);
const LEAD_STATUSES = new Set(["new", "in_progress", "done"]);
const LEAD_PRIORITIES = new Set(["low", "normal", "high"]);
const LEAD_OUTCOMES = new Set(["pending", "success", "failure"]);
const ACTIVE_LEAD_STATUSES = new Set(["new", "in_progress"]);
const DEFAULT_DEPARTMENT = "unassigned";
const CORE_USER_IDS = new Set(["owner"]);
const LEGACY_SYSTEM_USER_IDS = new Set(["sales_help", "production_help"]);
const BIRTHDAY_KEYWORD_RE = /(?:день\s*рожд(?:ения|енье)?|д\.?\s*р\.?|birthday|bday|🎂)/giu;
const EVENT_DATE_TOKEN_RE = /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/g;
const TRAINING_STATUSES = new Set(["onboarding", "active", "certified", "paused"]);
const TRAINING_STAGES = new Set(["foundation", "diagnostics", "dialog_control", "closing"]);
const TRAINING_REVIEW_CHANNELS = new Set(["call", "zoom", "chat", "email"]);
const TRAINING_REVIEW_RED_FLAGS = new Set([
  "interrupted_client",
  "talked_too_much",
  "complex_terms",
  "pressure",
  "reading_script"
]);
const SALES_PLAN_PERIODS = ["day", "week", "month"];
const DAY_MS = 24 * 60 * 60 * 1000;
const SECRET_LABELS = {
  future: "Future Mode",
  adadsw: "Комбо ADADSW",
  "logo-2tap": "Секрет двойного тапа по логотипу",
  "logo-longpress-2s": "Секрет долгого нажатия логотипа",
  "qa-smoke-secret": "QA smoke secret"
};
const BIRTHDAY_RELATIVE_KEYWORDS = [
  {
    relation: "wife",
    title: "День рождения жены клиента",
    keywords: ["жена", "жены", "супруга", "wife", "spouse"]
  },
  {
    relation: "husband",
    title: "День рождения мужа клиента",
    keywords: ["муж", "мужа", "супруг", "husband"]
  },
  {
    relation: "daughter",
    title: "День рождения дочери клиента",
    keywords: ["дочь", "дочери", "дочка", "daughter"]
  },
  {
    relation: "son",
    title: "День рождения сына клиента",
    keywords: ["сын", "сына", "сыну", "son"]
  },
  {
    relation: "children",
    title: "День рождения ребенка клиента",
    keywords: ["ребенок", "ребёнок", "дети", "детей", "child", "children"]
  },
  {
    relation: "mother",
    title: "День рождения мамы клиента",
    keywords: ["мама", "мамы", "мать", "mother", "mom"]
  },
  {
    relation: "father",
    title: "День рождения отца клиента",
    keywords: ["папа", "папы", "отец", "father", "dad"]
  },
  {
    relation: "parents",
    title: "День рождения родителей клиента",
    keywords: ["родители", "родителей", "parents"]
  },
  {
    relation: "sister",
    title: "День рождения сестры клиента",
    keywords: ["сестра", "сестры", "sister"]
  },
  {
    relation: "brother",
    title: "День рождения брата клиента",
    keywords: ["брат", "брата", "brother"]
  },
  {
    relation: "grandmother",
    title: "День рождения бабушки клиента",
    keywords: ["бабушка", "бабушки", "grandmother", "grandma"]
  },
  {
    relation: "grandfather",
    title: "День рождения дедушки клиента",
    keywords: ["дедушка", "дедушки", "grandfather", "grandpa"]
  },
  {
    relation: "grandparents",
    title: "День рождения бабушки и дедушки клиента",
    keywords: ["бабушка и дедушка", "дедушка и бабушка", "grandparents"]
  },
  {
    relation: "mother_in_law",
    title: "День рождения тещи или свекрови клиента",
    keywords: ["теща", "тёща", "свекровь", "mother-in-law", "mother in law"]
  },
  {
    relation: "father_in_law",
    title: "День рождения тестя или свекра клиента",
    keywords: ["тесть", "свекор", "свёкор", "father-in-law", "father in law"]
  },
  {
    relation: "aunt",
    title: "День рождения тети клиента",
    keywords: ["тетя", "тётя", "тети", "aunt"]
  },
  {
    relation: "uncle",
    title: "День рождения дяди клиента",
    keywords: ["дядя", "дяди", "uncle"]
  },
  {
    relation: "niece",
    title: "День рождения племянницы клиента",
    keywords: ["племянница", "племянницы", "niece"]
  },
  {
    relation: "nephew",
    title: "День рождения племянника клиента",
    keywords: ["племянник", "племянника", "nephew"]
  },
  {
    relation: "cousin",
    title: "День рождения двоюродного родственника клиента",
    keywords: ["двоюрод", "cousin"]
  },
  {
    relation: "godmother",
    title: "День рождения крестной клиента",
    keywords: ["крестная", "крёстная", "godmother"]
  },
  {
    relation: "godfather",
    title: "День рождения крестного клиента",
    keywords: ["крестный", "крёстный", "godfather"]
  },
  {
    relation: "partner",
    title: "День рождения партнера клиента",
    keywords: ["партнер", "партнёр", "девушка", "парень", "fiance", "fiancee", "partner"]
  }
];

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
let SHOULD_PERSIST_ADMIN_USERS_MIGRATION = false;

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
    leads: [],
    crm: {
      importantEvents: []
    },
    training: {
      profiles: [],
      callReviews: []
    },
    performance: createDefaultPerformanceData()
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
    leads: Array.isArray(base.leads) ? base.leads.map((lead) => normalizeLead(lead)) : [],
    crm: normalizeCrmData(base.crm),
    training: normalizeTrainingData(base.training),
    performance: normalizePerformanceData(base.performance)
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
  if (ADMIN_ROLES.has(role)) {
    return role;
  }
  if (LEGACY_ROLE_ALIASES.has(role)) {
    return ROLE_MANAGER;
  }
  return ROLE_MANAGER;
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

function normalizeLeadOutcome(value, statusValue = "new") {
  const outcome = sanitizeText(value, 20).toLowerCase();
  if (LEAD_OUTCOMES.has(outcome)) {
    return outcome;
  }
  const status = sanitizeText(statusValue, 30).toLowerCase();
  return status === "done" ? "pending" : "pending";
}

function normalizeLeadComment(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const text = sanitizeText(source.text, 2000);
  if (!text) {
    return null;
  }

  const createdAt = sanitizeText(source.createdAt, 64) || new Date().toISOString();
  const idSeed = sanitizeText(source.id, 120) || `${createdAt}_${index}_${text.slice(0, 24)}`;
  const id = sanitizeText(source.id, 120) || `cmt_${Buffer.from(idSeed).toString("base64url").slice(0, 16)}`;
  const authorId = normalizeUserId(source.authorId, "");
  const authorUsername = normalizeUserId(source.authorUsername, "") || (authorId !== "workspace" ? authorId : "");
  const authorRole = sanitizeText(source.authorRole, 20).toLowerCase();

  return {
    id,
    text,
    authorId,
    authorUsername,
    authorName: sanitizeText(source.authorName, 120) || "Менеджер",
    authorRole,
    createdAt
  };
}

function normalizeLead(input) {
  const source = input && typeof input === "object" ? input : {};
  const fallbackSeed = sanitizeText(source.createdAt, 64) || sanitizeText(source.name, 40) || "legacy";
  const fallbackId = `lead_legacy_${Buffer.from(fallbackSeed).toString("base64url").slice(0, 12)}`;
  const id = sanitizeText(source.id, 120) || fallbackId;
  const comments = Array.isArray(source.comments)
    ? source.comments
        .map((comment, index) => normalizeLeadComment(comment, index))
        .filter(Boolean)
    : [];

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
    outcome: normalizeLeadOutcome(source.outcome, source.status),
    internalNote: sanitizeText(source.internalNote, 2000),
    updatedById: normalizeUserId(source.updatedById, ""),
    updatedByName: sanitizeText(source.updatedByName, 120),
    completedAt: sanitizeText(source.completedAt, 64),
    completedById: normalizeUserId(source.completedById, ""),
    completedByName: sanitizeText(source.completedByName, 120),
    comments,
    createdAt: sanitizeText(source.createdAt, 64) || new Date().toISOString(),
    updatedAt: sanitizeText(source.updatedAt, 64) || new Date().toISOString()
  };
}

function normalizeIsoDate(value) {
  const raw = sanitizeText(value, 20);
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return "";
  }
  return raw;
}

function normalizeMonthDay(value) {
  const raw = sanitizeText(value, 10);
  if (!raw || !/^\d{2}-\d{2}$/.test(raw)) {
    return "";
  }
  return raw;
}

function clampInt(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const rounded = Math.round(numeric);
  if (rounded < min) {
    return min;
  }
  if (rounded > max) {
    return max;
  }
  return rounded;
}

function normalizeTrainingStatus(value) {
  const raw = sanitizeText(value, 30).toLowerCase();
  return TRAINING_STATUSES.has(raw) ? raw : "onboarding";
}

function normalizeTrainingStage(value) {
  const raw = sanitizeText(value, 40).toLowerCase();
  return TRAINING_STAGES.has(raw) ? raw : "foundation";
}

function normalizeTrainingReviewChannel(value) {
  const raw = sanitizeText(value, 20).toLowerCase();
  return TRAINING_REVIEW_CHANNELS.has(raw) ? raw : "call";
}

function normalizeTrainingReviewRedFlags(input) {
  const items = Array.isArray(input) ? input : [];
  const dedup = new Set();
  items.forEach((item) => {
    const flag = sanitizeText(item, 40).toLowerCase();
    if (flag && TRAINING_REVIEW_RED_FLAGS.has(flag)) {
      dedup.add(flag);
    }
  });
  return Array.from(dedup);
}

function resolveTrainingStageByDay(day) {
  if (day >= 24) {
    return "closing";
  }
  if (day >= 16) {
    return "dialog_control";
  }
  if (day >= 8) {
    return "diagnostics";
  }
  return "foundation";
}

function normalizeTrainingProfile(input) {
  const source = input && typeof input === "object" ? input : {};
  const userId = normalizeUserId(source.userId, "");
  if (!userId) {
    return null;
  }

  const createdAt = sanitizeText(source.createdAt, 64) || new Date().toISOString();
  const updatedAt = sanitizeText(source.updatedAt, 64) || createdAt;
  const currentDay = clampInt(source.currentDay, 1, 30, 1);
  const hasStage = Boolean(sanitizeText(source.stage, 40));

  return {
    userId,
    planStartDate: normalizeIsoDate(source.planStartDate),
    currentDay,
    stage: hasStage ? normalizeTrainingStage(source.stage) : resolveTrainingStageByDay(currentDay),
    status: normalizeTrainingStatus(source.status),
    confidence: clampInt(source.confidence, 1, 5, 3),
    energy: clampInt(source.energy, 1, 5, 3),
    control: clampInt(source.control, 1, 5, 3),
    notes: sanitizeText(source.notes, 2400),
    createdAt,
    updatedAt,
    updatedById: normalizeUserId(source.updatedById, ""),
    updatedByName: sanitizeText(source.updatedByName, 120)
  };
}

function normalizeTrainingReviewScore(value, max) {
  return clampInt(value, 0, max, 0);
}

function normalizeTrainingCallReview(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const userId = normalizeUserId(source.userId, "");
  if (!userId) {
    return null;
  }

  const createdAt = sanitizeText(source.createdAt, 64) || new Date().toISOString();
  const idSeed = sanitizeText(source.id, 120) || `${userId}_${createdAt}_${index}`;
  const id = sanitizeText(source.id, 120) || `rev_${Buffer.from(idSeed).toString("base64url").slice(0, 18)}`;

  const start = normalizeTrainingReviewScore(source.start, 15);
  const diagnostics = normalizeTrainingReviewScore(source.diagnostics, 25);
  const presentation = normalizeTrainingReviewScore(source.presentation, 20);
  const objections = normalizeTrainingReviewScore(source.objections, 15);
  const closing = normalizeTrainingReviewScore(source.closing, 15);
  const crm = normalizeTrainingReviewScore(source.crm, 10);
  const totalScore = start + diagnostics + presentation + objections + closing + crm;

  return {
    id,
    userId,
    reviewerId: normalizeUserId(source.reviewerId, ""),
    reviewerName: sanitizeText(source.reviewerName, 120) || "Руководитель",
    channel: normalizeTrainingReviewChannel(source.channel),
    start,
    diagnostics,
    presentation,
    objections,
    closing,
    crm,
    totalScore: clampInt(totalScore, 0, 100, 0),
    redFlags: normalizeTrainingReviewRedFlags(source.redFlags),
    confidence: clampInt(source.confidence, 1, 5, 3),
    energy: clampInt(source.energy, 1, 5, 3),
    control: clampInt(source.control, 1, 5, 3),
    comment: sanitizeText(source.comment, 2000),
    createdAt
  };
}

function normalizeTrainingData(input) {
  const source = input && typeof input === "object" ? input : {};
  const profiles = Array.isArray(source.profiles)
    ? source.profiles.map((item) => normalizeTrainingProfile(item)).filter(Boolean)
    : [];
  const callReviews = Array.isArray(source.callReviews)
    ? source.callReviews
        .map((item, index) => normalizeTrainingCallReview(item, index))
        .filter(Boolean)
    : [];

  return {
    profiles,
    callReviews
  };
}

function createDefaultPerformanceData() {
  return {
    plans: {
      day: {
        target: 0,
        updatedAt: "",
        updatedById: "",
        updatedByName: ""
      },
      week: {
        target: 0,
        updatedAt: "",
        updatedById: "",
        updatedByName: ""
      },
      month: {
        target: 0,
        updatedAt: "",
        updatedById: "",
        updatedByName: ""
      }
    },
    trainingAssignments: []
  };
}

function normalizePlanTarget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100000, Math.round(numeric)));
}

function normalizePerformancePlanEntry(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    target: normalizePlanTarget(source.target),
    updatedAt: sanitizeText(source.updatedAt, 64),
    updatedById: normalizeUserId(source.updatedById, ""),
    updatedByName: sanitizeText(source.updatedByName, 120)
  };
}

function normalizeTrainingAssignment(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const userId = normalizeUserId(source.userId, "");
  if (!userId) {
    return null;
  }

  const updatedAt = sanitizeText(source.updatedAt, 64) || sanitizeText(source.assignedAt, 64);
  const idSeed = sanitizeText(source.id, 120) || `${userId}_${updatedAt || index}`;
  return {
    id: sanitizeText(source.id, 120) || `tas_${Buffer.from(idSeed).toString("base64url").slice(0, 16)}`,
    userId,
    assigned: Boolean(source.assigned),
    note: sanitizeText(source.note, 1200),
    assignedAt: sanitizeText(source.assignedAt, 64),
    assignedById: normalizeUserId(source.assignedById, ""),
    assignedByName: sanitizeText(source.assignedByName, 120),
    updatedAt,
    updatedById: normalizeUserId(source.updatedById, ""),
    updatedByName: sanitizeText(source.updatedByName, 120)
  };
}

function normalizePerformanceData(input) {
  const source = input && typeof input === "object" ? input : {};
  const defaults = createDefaultPerformanceData();
  const plansInput = source.plans && typeof source.plans === "object" ? source.plans : {};
  const plans = {
    day: normalizePerformancePlanEntry(plansInput.day || defaults.plans.day),
    week: normalizePerformancePlanEntry(plansInput.week || defaults.plans.week),
    month: normalizePerformancePlanEntry(plansInput.month || defaults.plans.month)
  };

  const assignmentsInput = Array.isArray(source.trainingAssignments) ? source.trainingAssignments : [];
  const dedupByUser = new Map();
  assignmentsInput.forEach((item, index) => {
    const assignment = normalizeTrainingAssignment(item, index);
    if (!assignment) {
      return;
    }
    dedupByUser.set(assignment.userId, assignment);
  });

  return {
    plans,
    trainingAssignments: Array.from(dedupByUser.values())
  };
}

function ensurePerformanceStorage(data) {
  const normalized = normalizePerformanceData(data?.performance);
  data.performance = normalized;
  return normalized;
}

function getTrainingAssignmentEntry(performance, userId) {
  const safeUserId = normalizeUserId(userId, "");
  if (!safeUserId) {
    return null;
  }
  const list = Array.isArray(performance?.trainingAssignments) ? performance.trainingAssignments : [];
  return list.find((item) => item.userId === safeUserId) || null;
}

function toPublicTrainingAssignment(assignment) {
  if (!assignment) {
    return {
      userId: "",
      assigned: false,
      note: "",
      assignedAt: "",
      assignedByName: "",
      updatedAt: ""
    };
  }

  return {
    userId: assignment.userId,
    assigned: Boolean(assignment.assigned),
    note: assignment.note || "",
    assignedAt: assignment.assignedAt || "",
    assignedByName: assignment.assignedByName || "",
    updatedAt: assignment.updatedAt || ""
  };
}

function isTrainingAssignedForUser(data, userId) {
  const performance = ensurePerformanceStorage(data);
  const assignment = getTrainingAssignmentEntry(performance, userId);
  return Boolean(assignment && assignment.assigned);
}

function canAccessTrainingPanel(actor, data) {
  if (!actor) {
    return false;
  }

  if (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT) {
    return true;
  }

  if (actor.role === ROLE_MANAGER) {
    return Boolean(data && isTrainingAssignedForUser(data, actor.id));
  }

  return false;
}

function canManageTrainingAssignments(actor) {
  return Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT));
}

function canManageSalesPlans(actor) {
  return Boolean(actor && actor.role === ROLE_OWNER);
}

function canManageTrainingAssignmentTarget(actor, targetUser) {
  if (!canManageTrainingAssignments(actor) || !targetUser) {
    return false;
  }

  if (targetUser.role !== ROLE_MANAGER) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_PRODUCT) {
    return targetUser.department === actor.department;
  }

  return false;
}

function getManageableTrainingManagers(actor) {
  if (!canManageTrainingAssignments(actor)) {
    return [];
  }

  return ADMIN_USERS
    .filter((user) => canManageTrainingAssignmentTarget(actor, user))
    .map((user) => toPublicAdminUser(user))
    .sort((left, right) => {
      const leftName = left.name || left.username || left.id;
      const rightName = right.name || right.username || right.id;
      return String(leftName).localeCompare(String(rightName), "ru");
    });
}

function getTrainingAssignmentsPayload(actor, data) {
  const performance = ensurePerformanceStorage(data);
  const managers = getManageableTrainingManagers(actor);
  return managers.map((user) => ({
    user,
    assignment: toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, user.id))
  }));
}

function normalizeImportantEvent(input) {
  const source = input && typeof input === "object" ? input : {};
  const id = sanitizeText(source.id, 120);
  const leadId = sanitizeText(source.leadId, 120);

  if (!id || !leadId) {
    return null;
  }

  const createdAt = sanitizeText(source.createdAt, 64) || new Date().toISOString();
  const updatedAt = sanitizeText(source.updatedAt, 64) || createdAt;

  return {
    id,
    leadId,
    type: sanitizeText(source.type, 40).toLowerCase() || "birthday",
    relation: sanitizeText(source.relation, 40).toLowerCase() || "client",
    title: sanitizeText(source.title, 120) || "Важное событие",
    eventDate: normalizeIsoDate(source.eventDate),
    monthDay: normalizeMonthDay(source.monthDay),
    nextOccurrence: normalizeIsoDate(source.nextOccurrence),
    sourceText: sanitizeText(source.sourceText, 260),
    source: sanitizeText(source.source, 40) || "auto",
    clientName: sanitizeText(source.clientName, 120),
    clientContact: sanitizeText(source.clientContact, 140),
    createdAt,
    updatedAt
  };
}

function normalizeCrmData(input) {
  const source = input && typeof input === "object" ? input : {};
  const events = Array.isArray(source.importantEvents)
    ? source.importantEvents.map((item) => normalizeImportantEvent(item)).filter(Boolean)
    : [];

  return {
    importantEvents: events
  };
}

function daysInMonthUtc(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeYearPart(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  if (numeric >= 1000 && numeric <= 9999) {
    return numeric;
  }

  if (numeric >= 0 && numeric <= 99) {
    return numeric <= 40 ? 2000 + numeric : 1900 + numeric;
  }

  return null;
}

function parseDateToken(token) {
  const raw = sanitizeText(token, 30);
  if (!raw) {
    return null;
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = normalizeYearPart(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!year || month < 1 || month > 12) {
      return null;
    }
    if (day < 1 || day > daysInMonthUtc(year, month)) {
      return null;
    }
    return { year, month, day, hasYear: true };
  }

  const classicMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!classicMatch) {
    return null;
  }

  const day = Number(classicMatch[1]);
  const month = Number(classicMatch[2]);
  const year = classicMatch[3] ? normalizeYearPart(classicMatch[3]) : null;

  if (month < 1 || month > 12 || day < 1) {
    return null;
  }

  const maxDay = year ? daysInMonthUtc(year, month) : daysInMonthUtc(2000, month);
  if (day > maxDay) {
    return null;
  }

  return {
    year,
    month,
    day,
    hasYear: Boolean(year)
  };
}

function toIsoDateUtc(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function computeNextOccurrenceIso(month, day, nowDate = new Date()) {
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1) {
    return "";
  }

  const todayUtc = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );

  let year = nowDate.getUTCFullYear();
  let safeDay = Math.min(day, daysInMonthUtc(year, month));
  let candidateUtc = Date.UTC(year, month - 1, safeDay);

  if (candidateUtc < todayUtc) {
    year += 1;
    safeDay = Math.min(day, daysInMonthUtc(year, month));
    candidateUtc = Date.UTC(year, month - 1, safeDay);
  }

  const candidate = new Date(candidateUtc);
  return toIsoDateUtc(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, candidate.getUTCDate());
}

function buildImportantEventId(seed) {
  const digest = crypto.createHash("sha1").update(String(seed || "")).digest("hex");
  return `evt_${digest.slice(0, 16)}`;
}

function getLeadTextForEventDetection(lead) {
  const commentsText = Array.isArray(lead?.comments)
    ? lead.comments.map((item) => sanitizeText(item?.text, 400)).filter(Boolean).join(" ")
    : "";

  return [
    sanitizeText(lead?.message, 2200),
    sanitizeText(lead?.internalNote, 2200),
    sanitizeText(lead?.contact, 220),
    sanitizeText(lead?.name, 160),
    commentsText
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeKeywordText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/ё/g, "е");
}

function detectBirthdayRelation(context) {
  const source = normalizeKeywordText(context);
  if (!source) {
    return {
      relation: "client",
      title: "День рождения клиента"
    };
  }

  for (const rule of BIRTHDAY_RELATIVE_KEYWORDS) {
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
    const matched = keywords.some((keyword) => source.includes(normalizeKeywordText(keyword)));
    if (matched) {
      return {
        relation: rule.relation,
        title: rule.title
      };
    }
  }

  return {
    relation: "client",
    title: "День рождения клиента"
  };
}

function extractImportantEventsFromLead(lead) {
  const text = getLeadTextForEventDetection(lead);
  if (!text) {
    return [];
  }

  const out = [];
  const now = new Date();
  BIRTHDAY_KEYWORD_RE.lastIndex = 0;

  let match;
  let keywordIndex = 0;
  while ((match = BIRTHDAY_KEYWORD_RE.exec(text)) !== null) {
    const from = Math.max(0, match.index - 32);
    const to = Math.min(text.length, match.index + String(match[0] || "").length + 96);
    const context = text.slice(from, to).replace(/\s+/g, " ").trim();
    const contextTokens = context.match(EVENT_DATE_TOKEN_RE) || [];
    const fullTokens = contextTokens.length > 0 ? contextTokens : text.match(EVENT_DATE_TOKEN_RE) || [];

    let parsedDate = null;
    for (const token of fullTokens) {
      const parsed = parseDateToken(token);
      if (parsed) {
        parsedDate = parsed;
        break;
      }
    }

    const monthDay = parsedDate
      ? `${String(parsedDate.month).padStart(2, "0")}-${String(parsedDate.day).padStart(2, "0")}`
      : "";
    const eventDate = parsedDate && parsedDate.hasYear
      ? toIsoDateUtc(parsedDate.year, parsedDate.month, parsedDate.day)
      : "";
    const nextOccurrence = parsedDate
      ? computeNextOccurrenceIso(parsedDate.month, parsedDate.day, now)
      : "";
    const relationMeta = detectBirthdayRelation(context);
    const id = buildImportantEventId(
      `${lead.id}|birthday|${relationMeta.relation}|${monthDay || "unknown"}|${context.toLowerCase()}|${keywordIndex}`
    );

    out.push(
      normalizeImportantEvent({
        id,
        leadId: lead.id,
        type: "birthday",
        relation: relationMeta.relation,
        title: relationMeta.title,
        eventDate,
        monthDay,
        nextOccurrence,
        sourceText: context || String(match[0] || ""),
        source: "auto",
        clientName: lead.name,
        clientContact: lead.contact
      })
    );

    keywordIndex += 1;
  }

  const dedup = new Map();
  out.filter(Boolean).forEach((event) => {
    if (!dedup.has(event.id)) {
      dedup.set(event.id, event);
    }
  });
  return Array.from(dedup.values());
}

function ensureCrmStorage(data) {
  const normalized = normalizeCrmData(data?.crm);
  data.crm = normalized;
  return normalized;
}

function sortImportantEvents(events) {
  return [...events].sort((left, right) => {
    const leftKey = left.nextOccurrence || "9999-12-31";
    const rightKey = right.nextOccurrence || "9999-12-31";
    if (leftKey !== rightKey) {
      return leftKey.localeCompare(rightKey);
    }
    return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  });
}

function syncImportantEventsForAllLeads(data) {
  const crm = ensureCrmStorage(data);
  const existing = Array.isArray(crm.importantEvents) ? crm.importantEvents : [];
  const leads = Array.isArray(data.leads) ? data.leads.map((item) => normalizeLead(item)) : [];
  data.leads = leads;

  const nowIso = new Date().toISOString();
  const previousAutoById = new Map(
    existing
      .filter((event) => event && event.source === "auto")
      .map((event) => [event.id, event])
  );
  const manualEvents = existing.filter((event) => event && event.source !== "auto");
  const nextAutoEvents = [];

  leads.forEach((lead) => {
    const extracted = extractImportantEventsFromLead(lead);
    extracted.forEach((event) => {
      const prev = previousAutoById.get(event.id);
      nextAutoEvents.push({
        ...event,
        createdAt: prev?.createdAt || nowIso,
        updatedAt: nowIso
      });
    });
  });

  crm.importantEvents = sortImportantEvents([...manualEvents, ...nextAutoEvents]);
  data.crm = crm;
  return crm.importantEvents;
}

function getLeadEventsMap(events) {
  const map = new Map();
  const list = Array.isArray(events) ? events : [];

  list.forEach((event) => {
    if (!event || !event.leadId) {
      return;
    }
    if (!map.has(event.leadId)) {
      map.set(event.leadId, []);
    }
    map.get(event.leadId).push(event);
  });

  map.forEach((items, leadId) => {
    map.set(leadId, sortImportantEvents(items));
  });

  return map;
}

function attachLeadEvents(lead, leadEventsMap) {
  return {
    ...lead,
    importantEvents: Array.isArray(leadEventsMap.get(lead.id)) ? leadEventsMap.get(lead.id) : []
  };
}

function getTodayIsoUtc(date = new Date()) {
  return toIsoDateUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function getDaysUntilIsoDate(isoDate, nowDate = new Date()) {
  if (!isoDate) {
    return null;
  }

  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  return Math.floor((target - today) / (24 * 60 * 60 * 1000));
}

function ensureTrainingStorage(data) {
  const normalized = normalizeTrainingData(data?.training);
  data.training = normalized;
  return normalized;
}

function sortTrainingProfiles(profiles) {
  const statusOrder = {
    onboarding: 0,
    active: 1,
    paused: 2,
    certified: 3
  };

  return [...profiles].sort((left, right) => {
    const leftStatus = statusOrder[left.status] ?? 99;
    const rightStatus = statusOrder[right.status] ?? 99;
    if (leftStatus !== rightStatus) {
      return leftStatus - rightStatus;
    }
    if (left.currentDay !== right.currentDay) {
      return right.currentDay - left.currentDay;
    }
    return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
  });
}

function ensureTrainingProfileForUser(training, userId, nowIso = new Date().toISOString()) {
  const safeUserId = normalizeUserId(userId, "");
  if (!safeUserId) {
    return null;
  }

  const existing = training.profiles.find((item) => item.userId === safeUserId);
  if (existing) {
    return existing;
  }

  const created = normalizeTrainingProfile({
    userId: safeUserId,
    currentDay: 1,
    stage: "foundation",
    status: "onboarding",
    confidence: 3,
    energy: 3,
    control: 3,
    notes: "",
    createdAt: nowIso,
    updatedAt: nowIso
  });

  if (!created) {
    return null;
  }

  training.profiles.push(created);
  return created;
}

function getTrainingReviewsByUser(reviews, visibleUserIds) {
  const map = new Map();
  const list = Array.isArray(reviews) ? reviews : [];
  const allowed = visibleUserIds instanceof Set ? visibleUserIds : null;

  list.forEach((item) => {
    if (!item || !item.userId) {
      return;
    }
    if (allowed && !allowed.has(item.userId)) {
      return;
    }
    if (!map.has(item.userId)) {
      map.set(item.userId, []);
    }
    map.get(item.userId).push(item);
  });

  map.forEach((items, userId) => {
    const sorted = [...items].sort((left, right) =>
      String(right.createdAt || "").localeCompare(String(left.createdAt || ""))
    );
    map.set(userId, sorted);
  });

  return map;
}

function resolveTrainingMotivationLevel(profile) {
  const avgScore = Number(profile?.avgScore) || 0;
  const reviewCount = Number(profile?.reviewCount) || 0;

  if (avgScore >= 90 && reviewCount >= 4) {
    return "leader";
  }
  if (avgScore >= 75 && reviewCount >= 2) {
    return "boost";
  }
  return "base";
}

function buildTrainingProfileSummary(profile, reviews) {
  const list = Array.isArray(reviews) ? reviews : [];
  const reviewCount = list.length;
  const avgScore =
    reviewCount > 0
      ? Math.round(list.reduce((acc, item) => acc + (Number(item.totalScore) || 0), 0) / reviewCount)
      : 0;
  const lastReview = reviewCount > 0 ? list[0] : null;
  const redFlagsCount = list.reduce(
    (acc, item) => acc + (Array.isArray(item.redFlags) ? item.redFlags.length : 0),
    0
  );
  const progressPercent = Math.round((Math.max(1, Math.min(30, profile.currentDay || 1)) / 30) * 100);

  const out = {
    ...profile,
    reviewCount,
    avgScore,
    lastScore: lastReview ? Number(lastReview.totalScore) || 0 : 0,
    lastReviewAt: lastReview ? lastReview.createdAt : "",
    redFlagsCount,
    progressPercent
  };

  out.motivationLevel = resolveTrainingMotivationLevel(out);
  return out;
}

function trainingProfileWithUser(profile, usersById, reviewsByUser) {
  const summary = buildTrainingProfileSummary(profile, reviewsByUser.get(profile.userId) || []);
  const user = usersById.get(profile.userId) || null;
  return {
    ...summary,
    user
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
  const isOwner = role === ROLE_OWNER;
  const isProduct = role === ROLE_PRODUCT;
  const isManager = role === ROLE_MANAGER;
  return {
    canViewStats: isOwner || isProduct || isManager,
    canViewOwnerStats: isOwner,
    canAssignLeads: isOwner || isProduct,
    canTakeLeads: isOwner || isProduct || isManager,
    canViewAllLeads: isOwner || isProduct || isManager,
    canManageTraining: isOwner || isProduct,
    canReviewCalls: isOwner || isProduct,
    canManageUsers: isOwner,
    canAssignManagers: isOwner || isProduct,
    canManagePlans: isOwner,
    canViewTeamPerformance: isOwner || isProduct,
    canViewPersonalPerformance: isOwner || isProduct || isManager,
    canManageTrainingAssignments: isOwner || isProduct,
    canAccessTraining: isOwner || isProduct
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
      id: "product_lead",
      username: process.env.PRODUCT_LOGIN || "product_lead",
      password: process.env.PRODUCT_PASSWORD || "change-product",
      name: "Product Lead",
      role: ROLE_PRODUCT,
      department: "sales"
    },
    {
      id: "manager_main",
      username: process.env.MANAGER_LOGIN || "manager_main",
      password: process.env.MANAGER_PASSWORD || "change-manager",
      name: "Manager Main",
      role: ROLE_MANAGER,
      department: "sales"
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

function hasStoredLegacyUsers(storedUsers) {
  const list = Array.isArray(storedUsers) ? storedUsers : [];
  return list.some((rawUser) => {
    const source = rawUser && typeof rawUser === "object" ? rawUser : {};
    const rawId = normalizeUserId(source.id, "");
    const rawRole = sanitizeText(source.role, 30).toLowerCase();
    return LEGACY_SYSTEM_USER_IDS.has(rawId) || LEGACY_ROLE_ALIASES.has(rawRole);
  });
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
  SHOULD_PERSIST_ADMIN_USERS_MIGRATION = hasStoredLegacyUsers(storedUsers);
  const rawUsers = usersFromEnv.length > 0 ? usersFromEnv : [...createDefaultAdminUsers(), ...storedUsers];
  const users = [];
  const knownIds = new Set();
  const knownUsernames = new Set();

  rawUsers.forEach((rawUser, index) => {
    const user = normalizeAdminUser(rawUser, index);
    if (!user) {
      return;
    }
    if (LEGACY_SYSTEM_USER_IDS.has(user.id)) {
      SHOULD_PERSIST_ADMIN_USERS_MIGRATION = true;
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

function rebuildAdminUserIndexes() {
  ADMIN_USERS_BY_ID = new Map();
  ADMIN_USERS_BY_USERNAME = new Map();

  ADMIN_USERS.forEach((user) => {
    ADMIN_USERS_BY_ID.set(user.id, user);
    ADMIN_USERS_BY_USERNAME.set(user.username, user);
  });
}

function initializeAdminUsers() {
  ADMIN_USERS = createAdminUsers();
  rebuildAdminUserIndexes();
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
  return Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT || actor.role === ROLE_MANAGER));
}

function canReadLead(actor, lead) {
  if (!actor || !lead) {
    return false;
  }

  if (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT || actor.role === ROLE_MANAGER) {
    return true;
  }

  return false;
}

function canAssignLeads(actor) {
  return Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT));
}

function canManageUsers(actor) {
  return Boolean(actor && actor.role === ROLE_OWNER);
}

function canReadTrainingProfile(actor, targetUser) {
  if (!actor || !targetUser) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_PRODUCT) {
    return actor.department === targetUser.department;
  }

  return actor.id === targetUser.id;
}

function canManageTrainingProfile(actor, targetUser) {
  if (!actor || !targetUser) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_PRODUCT) {
    return actor.department === targetUser.department;
  }

  return false;
}

function canManageTargetDepartment(actor, targetDepartment) {
  if (!actor) {
    return false;
  }

  if (actor.role === ROLE_OWNER) {
    return true;
  }

  if (actor.role === ROLE_PRODUCT) {
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

  if (actor.role === ROLE_PRODUCT) {
    return targetUser.department === actor.department;
  }

  return false;
}

function canUpdateLeadStatus(actor, lead) {
  if (!actor || !lead) {
    return false;
  }

  if (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT) {
    return true;
  }

  if (actor.role === ROLE_MANAGER) {
    return lead.assigneeId === actor.id;
  }

  return false;
}

function getVisibleUsers(actor) {
  if (!actor) {
    return [];
  }

  if (actor.role === ROLE_OWNER) {
    return ADMIN_USERS.map((user) => toPublicAdminUser(user));
  }

  if (actor.role === ROLE_PRODUCT) {
    return ADMIN_USERS.filter((user) => user.role !== ROLE_OWNER).map((user) => toPublicAdminUser(user));
  }

  if (actor.role === ROLE_MANAGER) {
    const self = ADMIN_USERS_BY_ID.get(actor.id);
    return self ? [toPublicAdminUser(self)] : [];
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

  if (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT) {
    return allDepartments;
  }

  return [actor.department];
}

function resolveLeadMigrationTargetUser(department) {
  const safeDepartment = normalizeDepartment(department);
  const sameDepartmentProduct = ADMIN_USERS.find(
    (user) => user.role === ROLE_PRODUCT && user.department === safeDepartment
  );
  if (sameDepartmentProduct) {
    return sameDepartmentProduct;
  }

  const anyProduct = ADMIN_USERS.find((user) => user.role === ROLE_PRODUCT);
  if (anyProduct) {
    return anyProduct;
  }

  return ADMIN_USERS.find((user) => user.role === ROLE_OWNER) || null;
}

function buildLegacyLeadMigrationNote(existingNote, fromAssignee, toAssignee, nowIso) {
  const migrationNote =
    `[MIGRATION ${nowIso}] Аккаунт ${fromAssignee} удален. ` +
    `Заявка переназначена на ${toAssignee}.`;
  const combined = existingNote ? `${existingNote} ${migrationNote}` : migrationNote;
  return sanitizeText(combined, 2000);
}

async function runStartupMigrations() {
  if (SHOULD_PERSIST_ADMIN_USERS_MIGRATION) {
    await persistCustomAdminUsers();
    SHOULD_PERSIST_ADMIN_USERS_MIGRATION = false;
    console.log("Startup migration: admin roles normalized to owner/product/manager.");
  }

  const leadMigration = await withDataLock((data) => {
    const leads = Array.isArray(data.leads) ? data.leads.map((lead) => normalizeLead(lead)) : [];
    let reassignedCount = 0;
    const nowIso = new Date().toISOString();

    leads.forEach((lead) => {
      if (!LEGACY_SYSTEM_USER_IDS.has(lead.assigneeId)) {
        return;
      }
      if (!ACTIVE_LEAD_STATUSES.has(lead.status)) {
        return;
      }

      const targetUser = resolveLeadMigrationTargetUser(lead.department);
      if (!targetUser) {
        return;
      }

      const fromAssignee = sanitizeText(lead.assigneeName, 120) || lead.assigneeId;
      const toAssignee = sanitizeText(targetUser.name, 120) || targetUser.username || targetUser.id;
      lead.assigneeId = targetUser.id;
      lead.assigneeName = toAssignee;
      lead.internalNote = buildLegacyLeadMigrationNote(lead.internalNote, fromAssignee, toAssignee, nowIso);
      lead.updatedAt = nowIso;
      lead.updatedById = "system_migration";
      lead.updatedByName = "system";
      reassignedCount += 1;
    });

    if (reassignedCount > 0) {
      data.leads = leads;
      syncImportantEventsForAllLeads(data);
    }

    return { reassignedCount };
  });

  if (Number(leadMigration?.reassignedCount) > 0) {
    console.log(
      `Startup migration: reassigned ${leadMigration.reassignedCount} leads from legacy users to owner/product.`
    );
  }
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

function collectPeriodUniqueVisitors(byDay, count) {
  const unique = new Set();
  const now = new Date();
  for (let index = 0; index < count; index += 1) {
    const date = new Date(now);
    date.setUTCDate(now.getUTCDate() - index);
    const key = getDayKey(date);
    const dayEntry = normalizeDayEntry(byDay[key]);
    const visitors = dayEntry.visitors && typeof dayEntry.visitors === "object" ? dayEntry.visitors : {};
    Object.keys(visitors).forEach((visitorId) => {
      if (visitorId) {
        unique.add(visitorId);
      }
    });
  }
  return unique.size;
}

function resolveSecretLabel(secretId) {
  const id = String(secretId || "").trim().toLowerCase();
  if (!id) {
    return "Неизвестный секрет";
  }
  if (SECRET_LABELS[id]) {
    return SECRET_LABELS[id];
  }
  return id;
}

function resolveHardestSecret(bySecret) {
  const entries = Object.entries(bySecret || {}).filter(
    ([, count]) => Number.isFinite(Number(count)) && Number(count) > 0
  );
  if (entries.length === 0) {
    return { id: "", name: "Нет данных", finds: 0 };
  }

  entries.sort((left, right) => {
    const leftCount = Number(left[1]) || 0;
    const rightCount = Number(right[1]) || 0;
    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }
    return String(left[0]).localeCompare(String(right[0]), "ru");
  });

  const [id, finds] = entries[0];
  return {
    id,
    name: resolveSecretLabel(id),
    finds: Number(finds) || 0
  };
}

function getDefaultPermissions() {
  return {
    canViewStats: false,
    canViewOwnerStats: false,
    canAssignLeads: false,
    canTakeLeads: false,
    canViewAllLeads: true,
    canManageTraining: false,
    canReviewCalls: false,
    canManageUsers: false,
    canAssignManagers: false,
    canManagePlans: false,
    canViewTeamPerformance: false,
    canViewPersonalPerformance: false,
    canManageTrainingAssignments: false,
    canAccessTraining: false
  };
}

function getPermissionsForActor(actor, data = null) {
  if (!actor) {
    return getDefaultPermissions();
  }

  const base = getRolePermissions(actor.role);
  if (!data) {
    return base;
  }

  return {
    ...base,
    canAccessTraining: canAccessTrainingPanel(actor, data)
  };
}

function roundPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round(numeric * 10) / 10;
}

function parseTimestamp(value) {
  const ts = Date.parse(String(value || ""));
  return Number.isFinite(ts) ? ts : NaN;
}

function getPeriodStartTimestamps(nowDate = new Date()) {
  const dayStart = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );
  return {
    day: dayStart,
    week: dayStart - 6 * DAY_MS,
    month: dayStart - 29 * DAY_MS
  };
}

function calculateLeadPoints(lead) {
  const outcome = sanitizeText(lead?.outcome, 20).toLowerCase();
  const priority = normalizeLeadPriority(lead?.priority);
  const createdAt = parseTimestamp(lead?.createdAt);
  const completedAt = parseTimestamp(lead?.completedAt);
  let points = 0;

  if (outcome === "success") {
    points += 12;
  } else if (outcome === "failure") {
    points += 2;
  } else {
    points += 1;
  }

  if (priority === "high") {
    points += outcome === "success" ? 6 : 2;
  }

  if (
    outcome === "success" &&
    Number.isFinite(createdAt) &&
    Number.isFinite(completedAt) &&
    completedAt >= createdAt &&
    completedAt - createdAt <= DAY_MS
  ) {
    points += 3;
  }

  return Math.max(0, Math.round(points));
}

function createLeadPeriodBucket() {
  return {
    created: 0,
    processed: 0,
    success: 0,
    failure: 0,
    successByManagers: 0,
    successRatePercent: 0
  };
}

function buildLeadPeriodStats(leads, nowDate = new Date()) {
  const periods = {
    day: createLeadPeriodBucket(),
    week: createLeadPeriodBucket(),
    month: createLeadPeriodBucket()
  };
  const starts = getPeriodStartTimestamps(nowDate);
  const managerIds = new Set(
    ADMIN_USERS.filter((user) => user.role === ROLE_MANAGER).map((user) => user.id)
  );

  const list = Array.isArray(leads) ? leads : [];
  list.forEach((leadInput) => {
    const lead = normalizeLead(leadInput);
    const createdTs = parseTimestamp(lead.createdAt);
    const completedTs = parseTimestamp(lead.completedAt);
    const isDone = lead.status === "done";
    const isSuccess = isDone && lead.outcome === "success";
    const isFailure = isDone && lead.outcome === "failure";
    const isManagerSuccess = isSuccess && managerIds.has(lead.completedById);

    SALES_PLAN_PERIODS.forEach((period) => {
      const bucket = periods[period];
      const startTs = starts[period];
      if (Number.isFinite(createdTs) && createdTs >= startTs) {
        bucket.created += 1;
      }
      if (isDone && Number.isFinite(completedTs) && completedTs >= startTs) {
        bucket.processed += 1;
        if (isSuccess) {
          bucket.success += 1;
        }
        if (isFailure) {
          bucket.failure += 1;
        }
        if (isManagerSuccess) {
          bucket.successByManagers += 1;
        }
      }
    });
  });

  SALES_PLAN_PERIODS.forEach((period) => {
    const bucket = periods[period];
    bucket.successRatePercent =
      bucket.processed > 0
        ? roundPercent((bucket.success / bucket.processed) * 100)
        : 0;
  });

  return periods;
}

function createManagerPeriodStats(planTarget) {
  return {
    processed: 0,
    success: 0,
    failure: 0,
    points: 0,
    planTarget: Math.max(0, Number(planTarget) || 0),
    planCompletionPercent: 0,
    remainingToPlan: Math.max(0, Number(planTarget) || 0),
    successRatePercent: 0
  };
}

function buildManagerPerformance(leads, plans, nowDate = new Date()) {
  const managers = ADMIN_USERS
    .filter((user) => user.role === ROLE_MANAGER)
    .map((user) => toPublicAdminUser(user));
  const managerCount = managers.length;
  const starts = getPeriodStartTimestamps(nowDate);
  const planTargets = {
    day: normalizePlanTarget(plans?.day?.target),
    week: normalizePlanTarget(plans?.week?.target),
    month: normalizePlanTarget(plans?.month?.target)
  };
  const planPerManager = {
    day: managerCount > 0 ? Math.ceil(planTargets.day / managerCount) : 0,
    week: managerCount > 0 ? Math.ceil(planTargets.week / managerCount) : 0,
    month: managerCount > 0 ? Math.ceil(planTargets.month / managerCount) : 0
  };

  const rows = managers.map((manager) => ({
    userId: manager.id,
    user: manager,
    totals: {
      processed: 0,
      success: 0,
      failure: 0,
      points: 0,
      successRatePercent: 0
    },
    periods: {
      day: createManagerPeriodStats(planPerManager.day),
      week: createManagerPeriodStats(planPerManager.week),
      month: createManagerPeriodStats(planPerManager.month)
    }
  }));
  const byUserId = new Map(rows.map((row) => [row.userId, row]));

  const list = Array.isArray(leads) ? leads : [];
  list.forEach((leadInput) => {
    const lead = normalizeLead(leadInput);
    const row = byUserId.get(lead.completedById);
    if (!row || lead.status !== "done" || !lead.completedAt) {
      return;
    }

    const completedTs = parseTimestamp(lead.completedAt);
    if (!Number.isFinite(completedTs)) {
      return;
    }

    const outcome = lead.outcome;
    const points = calculateLeadPoints(lead);

    row.totals.processed += 1;
    row.totals.points += points;
    if (outcome === "success") {
      row.totals.success += 1;
    } else if (outcome === "failure") {
      row.totals.failure += 1;
    }

    SALES_PLAN_PERIODS.forEach((period) => {
      const periodStats = row.periods[period];
      if (completedTs < starts[period]) {
        return;
      }
      periodStats.processed += 1;
      periodStats.points += points;
      if (outcome === "success") {
        periodStats.success += 1;
      } else if (outcome === "failure") {
        periodStats.failure += 1;
      }
    });
  });

  rows.forEach((row) => {
    const totals = row.totals;
    totals.successRatePercent =
      totals.processed > 0
        ? roundPercent((totals.success / totals.processed) * 100)
        : 0;

    SALES_PLAN_PERIODS.forEach((period) => {
      const stats = row.periods[period];
      stats.planCompletionPercent =
        stats.planTarget > 0
          ? roundPercent((stats.success / stats.planTarget) * 100)
          : 0;
      stats.remainingToPlan = Math.max(0, stats.planTarget - stats.success);
      stats.successRatePercent =
        stats.processed > 0
          ? roundPercent((stats.success / stats.processed) * 100)
          : 0;
    });
  });

  const leaderboard = [...rows]
    .sort((left, right) => {
      const leftMonth = left.periods.month.points;
      const rightMonth = right.periods.month.points;
      if (leftMonth !== rightMonth) {
        return rightMonth - leftMonth;
      }

      const leftMonthSuccess = left.periods.month.success;
      const rightMonthSuccess = right.periods.month.success;
      if (leftMonthSuccess !== rightMonthSuccess) {
        return rightMonthSuccess - leftMonthSuccess;
      }

      const leftWeek = left.periods.week.points;
      const rightWeek = right.periods.week.points;
      if (leftWeek !== rightWeek) {
        return rightWeek - leftWeek;
      }

      const leftName = left.user?.name || left.user?.username || left.userId;
      const rightName = right.user?.name || right.user?.username || right.userId;
      return String(leftName).localeCompare(String(rightName), "ru");
    })
    .map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));

  return {
    managerCount,
    planPerManager,
    rows,
    leaderboard
  };
}

function buildSalesPlanProgress(plans, leadPeriodStats) {
  const out = {};
  SALES_PLAN_PERIODS.forEach((period) => {
    const target = normalizePlanTarget(plans?.[period]?.target);
    const achieved = Number(leadPeriodStats?.[period]?.successByManagers) || 0;
    out[period] = {
      target,
      achieved,
      remaining: Math.max(0, target - achieved),
      completionPercent: target > 0 ? roundPercent((achieved / target) * 100) : 0
    };
  });
  return out;
}

async function handleApi(req, res, urlObject) {
  const { pathname } = urlObject;

  // Allow calling the API from a separately hosted frontend (например, GitHub Pages).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

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
      outcome: "pending",
      internalNote: "",
      comments: [],
      updatedById: "",
      updatedByName: "",
      completedAt: "",
      completedById: "",
      completedByName: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await withDataLock((data) => {
      data.leads.unshift(lead);
      if (data.leads.length > 5000) {
        data.leads.length = 5000;
      }
      syncImportantEventsForAllLeads(data);
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
    const performance = ensurePerformanceStorage(data);
    const permissions = getPermissionsForActor(actor, data);
    const assignment = actor
      ? toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, actor.id))
      : toPublicTrainingAssignment(null);
    const trainingAssignments = actor && canManageTrainingAssignments(actor)
      ? getTrainingAssignmentsPayload(actor, data)
      : [];

    sendJson(res, 200, {
      ok: true,
      actor,
      permissions,
      users: actor ? getVisibleUsers(actor) : [],
      departments: actor ? getVisibleDepartments(actor, data) : collectKnownDepartments(data),
      trainingAccess: Boolean(actor && canAccessTrainingPanel(actor, data)),
      trainingAssignment: assignment,
      trainingAssignments
    });
    return;
  }

  if (pathname === "/api/admin/training" && req.method === "GET") {
    const actor = getOptionalAdmin(req);
    const rawLimit = Number(urlObject.searchParams.get("limit"));
    const reviewLimit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 400) : 100;
    const filterUserId = normalizeUserId(urlObject.searchParams.get("userId"), "");

    const payload = await withDataLock((data) => {
      const performance = ensurePerformanceStorage(data);
      const permissions = getPermissionsForActor(actor, data);
      const assignment = actor
        ? toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, actor.id))
        : toPublicTrainingAssignment(null);
      const trainingAssignments =
        actor && canManageTrainingAssignments(actor)
          ? getTrainingAssignmentsPayload(actor, data)
          : [];

      if (actor && !permissions.canAccessTraining) {
        return {
          error: "TRAINING_NOT_ASSIGNED",
          actor,
          permissions,
          assignment
        };
      }

      if (actor && actor.role === ROLE_MANAGER) {
        return {
          ok: true,
          generatedAt: new Date().toISOString(),
          actor,
          permissions,
          assignment,
          trainingAssignments,
          users: [],
          profiles: [],
          reviews: [],
          leaderboard: [],
          stats: {
            profilesTotal: 0,
            activeProfiles: 0,
            certifiedProfiles: 0,
            avgScore: 0,
            reviewsTotal: 0,
            reviewsThisWeek: 0
          }
        };
      }

      const training = ensureTrainingStorage(data);
      const visibleUsers = actor
        ? getVisibleUsers(actor)
            .filter((user) => user.role === ROLE_MANAGER)
            .filter((user) => {
              const targetUser = ADMIN_USERS_BY_ID.get(user.id);
              return targetUser ? canReadTrainingProfile(actor, targetUser) : false;
            })
        : [];
      const usersById = new Map(visibleUsers.map((user) => [user.id, user]));
      const visibleUserIds = new Set(visibleUsers.map((user) => user.id));

      const nowIso = new Date().toISOString();
      visibleUsers.forEach((user) => {
        ensureTrainingProfileForUser(training, user.id, nowIso);
      });
      training.profiles = sortTrainingProfiles(training.profiles);
      data.training = training;

      const reviewsByUser = getTrainingReviewsByUser(training.callReviews, visibleUserIds);
      const profiles = training.profiles
        .filter((profile) => visibleUserIds.has(profile.userId))
        .map((profile) => trainingProfileWithUser(profile, usersById, reviewsByUser));

      const allVisibleReviews = training.callReviews
        .filter((review) => visibleUserIds.has(review.userId))
        .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
        .map((review) => ({
          ...review,
          user: usersById.get(review.userId) || null
        }));

      const reviews = allVisibleReviews
        .filter((review) => !filterUserId || review.userId === filterUserId)
        .slice(0, reviewLimit);

      const avgScore =
        profiles.length > 0
          ? Math.round(
              profiles.reduce((acc, profile) => acc + (Number(profile.avgScore) || 0), 0) /
                profiles.length
            )
          : 0;
      const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const reviewsThisWeek = allVisibleReviews.filter((review) => {
        const ts = Date.parse(String(review.createdAt || ""));
        return Number.isFinite(ts) && ts >= weekAgoMs;
      }).length;

      const leaderboard = [...profiles]
        .sort((left, right) => {
          if (left.avgScore !== right.avgScore) {
            return right.avgScore - left.avgScore;
          }
          if (left.progressPercent !== right.progressPercent) {
            return right.progressPercent - left.progressPercent;
          }
          return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
        })
        .slice(0, 10);

      return {
        ok: true,
        generatedAt: nowIso,
        actor,
        permissions,
        assignment,
        trainingAssignments,
        users: visibleUsers,
        profiles,
        reviews,
        leaderboard,
        stats: {
          profilesTotal: profiles.length,
          activeProfiles: profiles.filter((profile) => profile.status === "active").length,
          certifiedProfiles: profiles.filter((profile) => profile.status === "certified").length,
          avgScore,
          reviewsTotal: allVisibleReviews.length,
          reviewsThisWeek
        }
      };
    });

    if (payload && payload.error === "TRAINING_NOT_ASSIGNED") {
      sendJson(res, 403, {
        error: "TRAINING_NOT_ASSIGNED",
        actor: payload.actor || actor || null,
        permissions: payload.permissions || getDefaultPermissions(),
        assignment: payload.assignment || toPublicTrainingAssignment(null)
      });
      return;
    }

    sendJson(res, 200, payload);
    return;
  }

  if (pathname.startsWith("/api/admin/training/profiles/") && req.method === "PATCH") {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    const userId = normalizeUserId(decodeURIComponent(pathname.replace("/api/admin/training/profiles/", "")), "");
    if (!userId) {
      sendJson(res, 400, { error: "USER_ID_REQUIRED" });
      return;
    }

    const targetUser = ADMIN_USERS_BY_ID.get(userId);
    if (!targetUser) {
      sendJson(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    if (targetUser.role !== ROLE_MANAGER) {
      sendJson(res, 400, { error: "TRAINING_TARGET_ROLE_INVALID" });
      return;
    }

    if (!canManageTrainingProfile(actor, targetUser)) {
      sendJson(res, 403, { error: "FORBIDDEN_TRAINING_PROFILE" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const hasPlanStartDate = Object.prototype.hasOwnProperty.call(body, "planStartDate");
    const hasCurrentDay = Object.prototype.hasOwnProperty.call(body, "currentDay");
    const hasStage = Object.prototype.hasOwnProperty.call(body, "stage");
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasConfidence = Object.prototype.hasOwnProperty.call(body, "confidence");
    const hasEnergy = Object.prototype.hasOwnProperty.call(body, "energy");
    const hasControl = Object.prototype.hasOwnProperty.call(body, "control");
    const hasNotes = Object.prototype.hasOwnProperty.call(body, "notes");

    if (
      !hasPlanStartDate &&
      !hasCurrentDay &&
      !hasStage &&
      !hasStatus &&
      !hasConfidence &&
      !hasEnergy &&
      !hasControl &&
      !hasNotes
    ) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const result = await withDataLock((data) => {
      if (!isTrainingAssignedForUser(data, targetUser.id)) {
        return { error: "TRAINING_NOT_ASSIGNED" };
      }

      const training = ensureTrainingStorage(data);
      const nowIso = new Date().toISOString();
      const profile = ensureTrainingProfileForUser(training, targetUser.id, nowIso);
      if (!profile) {
        return { error: "PROFILE_NOT_FOUND" };
      }

      let changed = false;

      if (hasPlanStartDate) {
        const nextPlanDate = normalizeIsoDate(body.planStartDate);
        if (profile.planStartDate !== nextPlanDate) {
          profile.planStartDate = nextPlanDate;
          changed = true;
        }
      }

      if (hasCurrentDay) {
        const nextDay = clampInt(body.currentDay, 1, 30, profile.currentDay);
        if (profile.currentDay !== nextDay) {
          profile.currentDay = nextDay;
          changed = true;
        }
        if (!hasStage) {
          const nextStageByDay = resolveTrainingStageByDay(nextDay);
          if (profile.stage !== nextStageByDay) {
            profile.stage = nextStageByDay;
            changed = true;
          }
        }
      }

      if (hasStage) {
        const nextStage = normalizeTrainingStage(body.stage);
        if (profile.stage !== nextStage) {
          profile.stage = nextStage;
          changed = true;
        }
      }

      if (hasStatus) {
        const nextStatus = normalizeTrainingStatus(body.status);
        if (profile.status !== nextStatus) {
          profile.status = nextStatus;
          changed = true;
        }
      }

      if (hasConfidence) {
        const nextConfidence = clampInt(body.confidence, 1, 5, profile.confidence);
        if (profile.confidence !== nextConfidence) {
          profile.confidence = nextConfidence;
          changed = true;
        }
      }

      if (hasEnergy) {
        const nextEnergy = clampInt(body.energy, 1, 5, profile.energy);
        if (profile.energy !== nextEnergy) {
          profile.energy = nextEnergy;
          changed = true;
        }
      }

      if (hasControl) {
        const nextControl = clampInt(body.control, 1, 5, profile.control);
        if (profile.control !== nextControl) {
          profile.control = nextControl;
          changed = true;
        }
      }

      if (hasNotes) {
        const nextNotes = sanitizeText(body.notes, 2400);
        if (profile.notes !== nextNotes) {
          profile.notes = nextNotes;
          changed = true;
        }
      }

      if (changed) {
        profile.updatedAt = nowIso;
        profile.updatedById = actor.id;
        profile.updatedByName = actor.name;
      }

      training.profiles = sortTrainingProfiles(training.profiles);
      data.training = training;

      const reviewsByUser = getTrainingReviewsByUser(training.callReviews, new Set([targetUser.id]));
      const usersById = new Map([[targetUser.id, toPublicAdminUser(targetUser)]]);

      return {
        ok: true,
        changed,
        profile: trainingProfileWithUser(profile, usersById, reviewsByUser)
      };
    });

    if (!result || !result.ok) {
      if (result?.error === "TRAINING_NOT_ASSIGNED") {
        sendJson(res, 403, { error: "TRAINING_NOT_ASSIGNED" });
        return;
      }
      sendJson(res, 400, { error: result?.error || "TRAINING_PROFILE_UPDATE_FAILED" });
      return;
    }

    sendJson(res, 200, { ok: true, changed: result.changed, profile: result.profile });
    return;
  }

  if (pathname === "/api/admin/training/reviews" && req.method === "POST") {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const userId = normalizeUserId(body.userId, "");
    if (!userId) {
      sendJson(res, 400, { error: "USER_ID_REQUIRED" });
      return;
    }

    const targetUser = ADMIN_USERS_BY_ID.get(userId);
    if (!targetUser) {
      sendJson(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    if (targetUser.role !== ROLE_MANAGER) {
      sendJson(res, 400, { error: "TRAINING_TARGET_ROLE_INVALID" });
      return;
    }

    if (!canManageTrainingProfile(actor, targetUser)) {
      sendJson(res, 403, { error: "FORBIDDEN_TRAINING_REVIEW" });
      return;
    }

    const result = await withDataLock((data) => {
      if (!isTrainingAssignedForUser(data, targetUser.id)) {
        return { error: "TRAINING_NOT_ASSIGNED" };
      }

      const training = ensureTrainingStorage(data);
      const nowIso = new Date().toISOString();
      const profile = ensureTrainingProfileForUser(training, targetUser.id, nowIso);
      if (!profile) {
        return { error: "PROFILE_NOT_FOUND" };
      }

      const review = normalizeTrainingCallReview(
        {
          userId: targetUser.id,
          reviewerId: actor.id,
          reviewerName: actor.name,
          channel: body.channel,
          start: body.start,
          diagnostics: body.diagnostics,
          presentation: body.presentation,
          objections: body.objections,
          closing: body.closing,
          crm: body.crm,
          redFlags: body.redFlags,
          confidence: body.confidence,
          energy: body.energy,
          control: body.control,
          comment: body.comment,
          createdAt: nowIso
        },
        training.callReviews.length
      );

      if (!review) {
        return { error: "REVIEW_INVALID" };
      }

      training.callReviews.push(review);
      if (training.callReviews.length > 6000) {
        training.callReviews = training.callReviews.slice(-6000);
      }

      if (profile.status === "onboarding") {
        profile.status = "active";
      }

      if (profile.status !== "paused") {
        const nextDay = Math.min(30, Math.max(1, profile.currentDay) + 1);
        profile.currentDay = nextDay;
        profile.stage = resolveTrainingStageByDay(nextDay);
      }

      profile.confidence = review.confidence;
      profile.energy = review.energy;
      profile.control = review.control;

      if (profile.status !== "paused" && profile.currentDay >= 30 && review.totalScore >= 75) {
        profile.status = "certified";
      }

      profile.updatedAt = nowIso;
      profile.updatedById = actor.id;
      profile.updatedByName = actor.name;

      training.profiles = sortTrainingProfiles(training.profiles);
      data.training = training;

      const reviewsByUser = getTrainingReviewsByUser(training.callReviews, new Set([targetUser.id]));
      const usersById = new Map([[targetUser.id, toPublicAdminUser(targetUser)]]);
      return {
        ok: true,
        review: {
          ...review,
          user: toPublicAdminUser(targetUser)
        },
        profile: trainingProfileWithUser(profile, usersById, reviewsByUser)
      };
    });

    if (!result || !result.ok) {
      const code = result?.error || "TRAINING_REVIEW_CREATE_FAILED";
      if (code === "TRAINING_NOT_ASSIGNED") {
        sendJson(res, 403, { error: code });
        return;
      }
      sendJson(res, code === "USER_NOT_FOUND" ? 404 : 400, { error: code });
      return;
    }

    sendJson(res, 201, { ok: true, review: result.review, profile: result.profile });
    return;
  }

  if (pathname === "/api/admin/training/assignments" && req.method === "GET") {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    if (!canManageTrainingAssignments(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_TRAINING_ASSIGNMENTS" });
      return;
    }

    const payload = await withDataLock((data) => ({
      ok: true,
      actor,
      permissions: getPermissionsForActor(actor, data),
      assignments: getTrainingAssignmentsPayload(actor, data)
    }));

    sendJson(res, 200, payload);
    return;
  }

  if (pathname.startsWith("/api/admin/training/assignments/") && req.method === "PATCH") {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    if (!canManageTrainingAssignments(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_TRAINING_ASSIGNMENTS" });
      return;
    }

    const userId = normalizeUserId(
      decodeURIComponent(pathname.replace("/api/admin/training/assignments/", "")),
      ""
    );
    if (!userId) {
      sendJson(res, 400, { error: "USER_ID_REQUIRED" });
      return;
    }

    const targetUser = ADMIN_USERS_BY_ID.get(userId);
    if (!targetUser) {
      sendJson(res, 404, { error: "USER_NOT_FOUND" });
      return;
    }

    if (!canManageTrainingAssignmentTarget(actor, targetUser)) {
      sendJson(res, 403, { error: "FORBIDDEN_TRAINING_ASSIGNMENT_TARGET" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const hasAssigned = Object.prototype.hasOwnProperty.call(body, "assigned");
    const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
    if (!hasAssigned && !hasNote) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const result = await withDataLock((data) => {
      const performance = ensurePerformanceStorage(data);
      const existing = getTrainingAssignmentEntry(performance, targetUser.id);
      const nowIso = new Date().toISOString();

      const nextAssigned = hasAssigned ? Boolean(body.assigned) : Boolean(existing?.assigned);
      const nextNote = hasNote ? sanitizeText(body.note, 1200) : sanitizeText(existing?.note, 1200);
      const assignedAt = nextAssigned
        ? (existing?.assignedAt || nowIso)
        : "";
      const assignedById = nextAssigned
        ? (existing?.assigned ? existing.assignedById || actor.id : actor.id)
        : "";
      const assignedByName = nextAssigned
        ? (existing?.assigned ? existing.assignedByName || actor.name : actor.name)
        : "";

      const assignment = normalizeTrainingAssignment({
        id: existing?.id || `tas_${targetUser.id}`,
        userId: targetUser.id,
        assigned: nextAssigned,
        note: nextNote,
        assignedAt,
        assignedById,
        assignedByName,
        updatedAt: nowIso,
        updatedById: actor.id,
        updatedByName: actor.name
      });

      if (!assignment) {
        return { error: "TRAINING_ASSIGNMENT_UPDATE_FAILED" };
      }

      performance.trainingAssignments = [
        ...performance.trainingAssignments.filter((item) => item.userId !== targetUser.id),
        assignment
      ];
      data.performance = performance;

      return {
        ok: true,
        assignment: {
          user: toPublicAdminUser(targetUser),
          assignment: toPublicTrainingAssignment(assignment)
        }
      };
    });

    if (!result || !result.ok) {
      sendJson(res, 400, { error: result?.error || "TRAINING_ASSIGNMENT_UPDATE_FAILED" });
      return;
    }

    sendJson(res, 200, result);
    return;
  }

  if (pathname === "/api/admin/plans" && req.method === "PATCH") {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    if (!canManageSalesPlans(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_PLANS" });
      return;
    }

    let body;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      sendJson(res, 400, { error: error.message || "INVALID_REQUEST" });
      return;
    }

    const getTargetValue = (period) => {
      const directKey = `${period}Target`;
      if (Object.prototype.hasOwnProperty.call(body, directKey)) {
        return body[directKey];
      }
      if (Object.prototype.hasOwnProperty.call(body, period)) {
        const value = body[period];
        if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "target")) {
          return value.target;
        }
        return value;
      }
      return undefined;
    };

    const targets = {
      day: getTargetValue("day"),
      week: getTargetValue("week"),
      month: getTargetValue("month")
    };

    if (
      targets.day === undefined &&
      targets.week === undefined &&
      targets.month === undefined
    ) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const result = await withDataLock((data) => {
      const performance = ensurePerformanceStorage(data);
      const nowIso = new Date().toISOString();

      SALES_PLAN_PERIODS.forEach((period) => {
        if (targets[period] === undefined) {
          return;
        }
        performance.plans[period] = {
          target: normalizePlanTarget(targets[period]),
          updatedAt: nowIso,
          updatedById: actor.id,
          updatedByName: actor.name
        };
      });

      data.performance = performance;
      const leadPeriodStats = buildLeadPeriodStats(data.leads, new Date());

      return {
        ok: true,
        plans: performance.plans,
        progress: buildSalesPlanProgress(performance.plans, leadPeriodStats)
      };
    });

    sendJson(res, 200, result);
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
    const requestedRole = normalizeRole(body.role);
    const role = requestedRole === ROLE_OWNER ? ROLE_MANAGER : requestedRole;

    if (!username || !password) {
      sendJson(res, 400, { error: "USERNAME_PASSWORD_REQUIRED" });
      return;
    }

    if (ADMIN_USERS_BY_USERNAME.has(username)) {
      sendJson(res, 400, { error: "USERNAME_TAKEN" });
      return;
    }

    const requestedId = normalizeUserId(body.id, `${role}_${username}`);
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
      role,
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
    const hasRole = Object.prototype.hasOwnProperty.call(body, "role");

    if (!hasUsername && !hasPassword && !hasName && !hasDepartment && !hasRole) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const nextUsername = hasUsername ? normalizeUserId(body.username, "") : targetUser.username;
    const nextPassword = hasPassword ? String(body.password || "").trim().slice(0, 200) : targetUser.password;
    const nextName = hasName ? sanitizeText(body.name, 120) || targetUser.name : targetUser.name;
    const nextDepartment = hasDepartment ? normalizeDepartment(body.department) : targetUser.department;
    const nextRole = hasRole ? normalizeRole(body.role) : targetUser.role;

    if (hasUsername && !nextUsername) {
      sendJson(res, 400, { error: "INVALID_USERNAME" });
      return;
    }

    if (hasPassword && !nextPassword) {
      sendJson(res, 400, { error: "INVALID_PASSWORD" });
      return;
    }

    if (hasRole && nextRole === ROLE_OWNER) {
      sendJson(res, 403, { error: "FORBIDDEN_OWNER_EDIT" });
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
    targetUser.role = nextRole;
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
      const training = ensureTrainingStorage(data);
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
      training.profiles = training.profiles.filter((profile) => profile.userId !== targetUser.id);
      training.callReviews = training.callReviews.filter((review) => review.userId !== targetUser.id);
      data.training = training;
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
    const actor = getOptionalAdmin(req);
    if (actor && !canViewStats(actor)) {
      sendJson(res, 403, { error: "FORBIDDEN_STATS" });
      return;
    }

    const stats = await withDataLock((data) => {
      const todayKey = getDayKey();
      const now = new Date();
      const todayEntry = normalizeDayEntry(data.visits.byDay[todayKey]);
      const engagement = normalizeEngagementData(data.engagement);
      const secrets = normalizeSecretsData(data.secrets);
      const performance = ensurePerformanceStorage(data);
      const last7Days = collectLastDays(data.visits.byDay, 7);
      const uniqueVisitors7d = collectPeriodUniqueVisitors(data.visits.byDay, 7);
      const uniqueVisitors30d = collectPeriodUniqueVisitors(data.visits.byDay, 30);
      const normalizedLeads = Array.isArray(data.leads) ? data.leads.map((lead) => normalizeLead(lead)) : [];
      data.leads = normalizedLeads;

      const leadsNew = normalizedLeads.filter((lead) => lead.status === "new").length;
      const leadsUnassigned = normalizedLeads.filter((lead) => !lead.assigneeId).length;
      const leadsProcessed = normalizedLeads.filter((lead) => lead.status === "done").length;
      const leadsSuccess = normalizedLeads.filter(
        (lead) => lead.status === "done" && lead.outcome === "success"
      ).length;
      const leadsFailure = normalizedLeads.filter(
        (lead) => lead.status === "done" && lead.outcome === "failure"
      ).length;
      const leadsPendingResult = Math.max(0, leadsProcessed - leadsSuccess - leadsFailure);
      const leadSuccessRatePercent =
        leadsProcessed > 0 ? Math.round((leadsSuccess / leadsProcessed) * 1000) / 10 : 0;

      const avgViewMs =
        engagement.samplesCount > 0
          ? Math.round(engagement.totalDurationMs / engagement.samplesCount)
          : 0;
      const todayRepeatVisits = Math.max(0, todayEntry.hits - todayEntry.uniqueVisitors);

      const secretHunters = Object.values(secrets.byVisitor || {}).filter((entry) => {
        const normalized = normalizeSecretVisitorEntry(entry);
        return (normalized.totalEvents || 0) > 0;
      }).length;
      const secretHuntersPercent =
        data.visits.uniqueVisitors > 0
          ? Math.round((secretHunters / data.visits.uniqueVisitors) * 1000) / 10
          : 0;
      const hardestSecret = resolveHardestSecret(secrets.bySecret);

      const dayAgoMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const sevenDaysAgoMs = dayAgoMs - 7 * DAY_MS;
      const monthAgoMs = dayAgoMs - 30 * DAY_MS;

      const personalProcessed = {
        today: 0,
        last7Days: 0,
        last30Days: 0
      };
      const personalPoints = {
        today: 0,
        last7Days: 0,
        last30Days: 0,
        total: 0
      };

      if (actor && actor.id) {
        normalizedLeads.forEach((lead) => {
          if (lead.completedById !== actor.id || !lead.completedAt) {
            return;
          }
          const ts = Date.parse(String(lead.completedAt));
          if (!Number.isFinite(ts)) {
            return;
          }
          if (ts >= dayAgoMs) {
            personalProcessed.today += 1;
          }
          if (ts >= sevenDaysAgoMs) {
            personalProcessed.last7Days += 1;
          }
          if (ts >= monthAgoMs) {
            personalProcessed.last30Days += 1;
          }

          const points = calculateLeadPoints(lead);
          personalPoints.total += points;
          if (ts >= dayAgoMs) {
            personalPoints.today += points;
          }
          if (ts >= sevenDaysAgoMs) {
            personalPoints.last7Days += points;
          }
          if (ts >= monthAgoMs) {
            personalPoints.last30Days += points;
          }
        });
      }

      const leadPeriodStats = buildLeadPeriodStats(normalizedLeads, now);
      const managerPerformance = buildManagerPerformance(normalizedLeads, performance.plans, now);
      const salesPlanProgress = buildSalesPlanProgress(performance.plans, leadPeriodStats);
      const visibleManagerRows =
        actor && actor.role === ROLE_PRODUCT
          ? managerPerformance.rows.filter((row) => row.user?.department === actor.department)
          : managerPerformance.rows;
      const visibleManagerIds = new Set(visibleManagerRows.map((row) => row.userId));
      const visibleLeaderboard = managerPerformance.leaderboard
        .filter((entry) => visibleManagerIds.has(entry.userId))
        .map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));
      const managerSelf = actor && actor.role === ROLE_MANAGER
        ? managerPerformance.rows.find((row) => row.userId === actor.id) || null
        : null;
      const assignedManagers = visibleManagerRows.filter((row) => {
        const assignment = getTrainingAssignmentEntry(performance, row.userId);
        return Boolean(assignment && assignment.assigned);
      }).length;
      const permissions = getPermissionsForActor(actor, data);
      const actorTrainingAssignment = actor
        ? toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, actor.id))
        : toPublicTrainingAssignment(null);

      return {
        actor,
        permissions,
        generatedAt: now.toISOString(),
        totalHits: data.visits.totalHits,
        uniqueVisitors: data.visits.uniqueVisitors,
        today: {
          date: todayKey,
          hits: todayEntry.hits,
          uniqueVisitors: todayEntry.uniqueVisitors
        },
        todayUniqueVisitors: todayEntry.uniqueVisitors,
        uniqueVisitors7d,
        uniqueVisitors30d,
        todayRepeatVisits,
        last7Days,
        leadsTotal: normalizedLeads.length,
        leadsNew,
        leadsUnassigned,
        leadsProcessed,
        leadsSuccess,
        leadsFailure,
        leadsPendingResult,
        leadSuccessRatePercent,
        avgViewMs,
        secretFindsTotal: secrets.totalEvents,
        secretHunters,
        secretHuntersPercent,
        hardestSecret,
        personalProcessed,
        personalPoints,
        periods: leadPeriodStats,
        plans: salesPlanProgress,
        managerPerformance: {
          managerCount: visibleManagerRows.length,
          planPerManager: managerPerformance.planPerManager,
          managers: visibleManagerRows,
          leaderboard: visibleLeaderboard,
          self: managerSelf
        },
        training: {
          canAccess: permissions.canAccessTraining,
          assignment: actorTrainingAssignment,
          assignedManagers
        },
        pointsThisMonth: managerSelf ? managerSelf.periods.month.points : personalPoints.last30Days,
        pointsTotal: managerSelf ? managerSelf.totals.points : personalPoints.total
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
      const events = syncImportantEventsForAllLeads(data);
      const leadEventsMap = getLeadEventsMap(events);
      const visibleLeads = actor
        ? normalizedLeads.filter((lead) => canReadLead(actor, lead))
        : normalizedLeads;
      const total = visibleLeads.length;
      const leads = visibleLeads
        .slice(offset, offset + limit)
        .map((lead) => attachLeadEvents(lead, leadEventsMap));
      const permissions = getPermissionsForActor(actor, data);
      return {
        leads,
        total,
        offset,
        limit,
        actor,
        permissions,
        trainingAccess: permissions.canAccessTraining
      };
    });
    sendJson(res, 200, payload);
    return;
  }

  if (
    pathname.startsWith("/api/admin/leads/") &&
    pathname.endsWith("/comments") &&
    req.method === "POST"
  ) {
    const actor = getOptionalAdmin(req);
    if (!actor) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    const basePath = "/api/admin/leads/";
    const suffix = "/comments";
    const encodedLeadId = pathname.slice(basePath.length, pathname.length - suffix.length);
    const id = decodeURIComponent(encodedLeadId || "");
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

    const commentText = sanitizeText(body.text, 2000);
    if (!commentText) {
      sendJson(res, 400, { error: "COMMENT_REQUIRED" });
      return;
    }

    const result = await withDataLock((data) => {
      const index = data.leads.findIndex((item) => normalizeLead(item).id === id);
      if (index < 0) {
        return { error: "LEAD_NOT_FOUND" };
      }

      const lead = normalizeLead(data.leads[index]);
      if (!canReadLead(actor, lead)) {
        return { error: "FORBIDDEN_COMMENT" };
      }

      const comment = normalizeLeadComment(
        {
          text: commentText,
          authorId: actor.id,
          authorUsername: actor.username,
          authorName: actor.name,
          authorRole: actor.role,
          createdAt: new Date().toISOString()
        },
        lead.comments.length
      );

      if (!comment) {
        return { error: "COMMENT_REQUIRED" };
      }

      lead.comments.push(comment);
      if (lead.comments.length > 300) {
        lead.comments = lead.comments.slice(-300);
      }
      lead.updatedAt = new Date().toISOString();
      lead.updatedById = actor.id;
      lead.updatedByName = actor.name;
      data.leads[index] = lead;

      const events = syncImportantEventsForAllLeads(data);
      const leadEventsMap = getLeadEventsMap(events);
      return {
        ok: true,
        comment,
        lead: attachLeadEvents(lead, leadEventsMap)
      };
    });

    if (!result || !result.ok) {
      const code = result?.error || "COMMENT_FAILED";
      if (code === "LEAD_NOT_FOUND") {
        sendJson(res, 404, { error: code });
        return;
      }
      if (code === "FORBIDDEN_COMMENT") {
        sendJson(res, 403, { error: code });
        return;
      }
      sendJson(res, 400, { error: code });
      return;
    }

    sendJson(res, 201, { ok: true, comment: result.comment, lead: result.lead });
    return;
  }

  if (pathname === "/api/admin/events" && req.method === "GET") {
    const actor = getOptionalAdmin(req);
    const rawLimit = Number(urlObject.searchParams.get("limit"));
    const scope = sanitizeText(urlObject.searchParams.get("scope"), 40).toLowerCase();
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.floor(rawLimit), 2000)
        : 500;

    const now = new Date();

    const payload = await withDataLock((data) => {
      const leads = Array.isArray(data.leads) ? data.leads.map((lead) => normalizeLead(lead)) : [];
      data.leads = leads;
      const events = syncImportantEventsForAllLeads(data);
      const leadsById = new Map(leads.map((lead) => [lead.id, lead]));

      const visibleEvents = events
        .map((event) => normalizeImportantEvent(event))
        .filter(Boolean)
        .filter((event) => {
          const lead = leadsById.get(event.leadId);
          if (!lead) {
            return false;
          }
          return actor ? canReadLead(actor, lead) : true;
        })
        .map((event) => {
          const lead = leadsById.get(event.leadId);
          const daysUntil = getDaysUntilIsoDate(event.nextOccurrence, now);
          const timeline =
            daysUntil === null
              ? "no_date"
              : daysUntil < 0
                ? "overdue"
                : daysUntil <= 7
                  ? "soon"
                  : "upcoming";

          return {
            ...event,
            daysUntil,
            timeline,
            lead: lead
              ? {
                  id: lead.id,
                  name: lead.name,
                  contact: lead.contact,
                  status: lead.status,
                  assigneeName: lead.assigneeName
                }
              : null
          };
        });

      const filteredEvents = visibleEvents.filter((event) => {
        if (scope === "today") {
          return event.daysUntil === 0;
        }
        if (scope === "overdue") {
          return event.timeline === "overdue";
        }
        if (scope === "soon") {
          return event.timeline === "soon";
        }
        if (scope === "upcoming") {
          return event.timeline === "soon" || event.timeline === "upcoming";
        }
        if (scope === "no_date") {
          return event.timeline === "no_date";
        }
        return true;
      });

      const sorted = filteredEvents.sort((left, right) => {
        const toSortRank = (item) => {
          if (item.daysUntil === 0) {
            return 0;
          }
          if (Number.isFinite(Number(item.daysUntil)) && Number(item.daysUntil) > 0) {
            return 1;
          }
          if (Number.isFinite(Number(item.daysUntil)) && Number(item.daysUntil) < 0) {
            return 2;
          }
          return 3;
        };

        const leftRank = toSortRank(left);
        const rightRank = toSortRank(right);
        if (leftRank !== rightRank) {
          return leftRank - rightRank;
        }

        if (leftRank === 0 || leftRank === 1) {
          return Number(left.daysUntil) - Number(right.daysUntil);
        }
        if (leftRank === 2) {
          return Number(right.daysUntil) - Number(left.daysUntil);
        }

        const leftDate = left.nextOccurrence || "9999-12-31";
        const rightDate = right.nextOccurrence || "9999-12-31";
        if (leftDate !== rightDate) {
          return leftDate.localeCompare(rightDate);
        }

        return String(left.title || "").localeCompare(String(right.title || ""), "ru");
      });

      const stats = {
        total: visibleEvents.length,
        today: visibleEvents.filter((event) => event.daysUntil === 0).length,
        overdue: visibleEvents.filter((event) => event.timeline === "overdue").length,
        soon: visibleEvents.filter((event) => event.timeline === "soon").length,
        upcoming: visibleEvents.filter((event) => event.timeline === "upcoming").length,
        noDate: visibleEvents.filter((event) => event.timeline === "no_date").length
      };

      const permissions = getPermissionsForActor(actor, data);

      return {
        ok: true,
        generatedAt: now.toISOString(),
        today: getTodayIsoUtc(now),
        events: sorted.slice(0, limit),
        total: sorted.length,
        limit,
        scope: scope || "all",
        stats,
        actor,
        permissions,
        trainingAccess: permissions.canAccessTraining
      };
    });

    sendJson(res, 200, payload);
    return;
  }

  if (
    pathname.startsWith("/api/admin/leads/") &&
    !pathname.endsWith("/comments") &&
    req.method === "DELETE"
  ) {
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

    const deletion = await withDataLock((data) => {
      const index = data.leads.findIndex((item) => normalizeLead(item).id === id);
      if (index < 0) {
        return { error: "LEAD_NOT_FOUND" };
      }

      if (!canAssignLeads(actor)) {
        return { error: "FORBIDDEN_DELETE" };
      }

      const lead = normalizeLead(data.leads[index]);
      if (!ACTIVE_LEAD_STATUSES.has(lead.status)) {
        return { error: "FORBIDDEN_DELETE_STATUS" };
      }

      data.leads.splice(index, 1);
      syncImportantEventsForAllLeads(data);

      return {
        ok: true,
        deletedLeadId: lead.id,
        deletedLeadStatus: lead.status
      };
    });

    if (!deletion || !deletion.ok) {
      const code = deletion?.error || "DELETE_FAILED";
      if (code === "LEAD_NOT_FOUND") {
        sendJson(res, 404, { error: code });
        return;
      }
      if (code === "FORBIDDEN_DELETE" || code === "FORBIDDEN_DELETE_STATUS") {
        sendJson(res, 403, { error: code });
        return;
      }
      sendJson(res, 400, { error: code });
      return;
    }

    sendJson(res, 200, deletion);
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
    const hasOutcome = Object.prototype.hasOwnProperty.call(body, "outcome");

    if (!hasStatus && !hasDepartment && !hasAssigneeId && !hasPriority && !hasInternalNote && !hasOutcome) {
      sendJson(res, 400, { error: "NO_UPDATABLE_FIELDS" });
      return;
    }

    const nextStatus = hasStatus ? sanitizeText(body.status, 30) : "";
    const nextDepartmentRaw = hasDepartment ? normalizeDepartment(body.department) : "";
    const nextAssigneeIdRaw = hasAssigneeId ? normalizeUserId(body.assigneeId, "") : "";
    const nextPriority = hasPriority ? sanitizeText(body.priority, 20) : "";
    const nextInternalNote = hasInternalNote ? sanitizeText(body.internalNote, 2000) : "";
    const nextOutcome = hasOutcome ? sanitizeText(body.outcome, 20).toLowerCase() : "";

    if (hasStatus && !LEAD_STATUSES.has(nextStatus)) {
      sendJson(res, 400, { error: "INVALID_STATUS" });
      return;
    }

    if (hasPriority && !LEAD_PRIORITIES.has(nextPriority)) {
      sendJson(res, 400, { error: "INVALID_PRIORITY" });
      return;
    }

    if (hasOutcome && !LEAD_OUTCOMES.has(nextOutcome)) {
      sendJson(res, 400, { error: "INVALID_OUTCOME" });
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
      let statusChanged = false;
      const isManager = actor.role === ROLE_MANAGER;
      const isManagerSelfTakeRequest = isManager && hasAssigneeId && nextAssigneeIdRaw === actor.id;
      const isManagerOwnLead = isManager && lead.assigneeId === actor.id;

      if (isManager && hasDepartment) {
        return { error: "FORBIDDEN_DEPARTMENT" };
      }

      if (isManager && hasAssigneeId && nextAssigneeIdRaw && nextAssigneeIdRaw !== actor.id) {
        return { error: "FORBIDDEN_ASSIGNMENT" };
      }

      if (isManagerSelfTakeRequest && lead.assigneeId && lead.assigneeId !== actor.id) {
        return { error: "MANAGER_CANNOT_TAKE_ASSIGNED" };
      }

      if (isManager && isManagerOwnLead && hasAssigneeId && !nextAssigneeIdRaw) {
        return { error: "MANAGER_CANNOT_UNASSIGN" };
      }

      if (hasStatus) {
        const managerCanTakeAndStart = isManagerSelfTakeRequest && nextStatus === "in_progress";
        if (!canUpdateLeadStatus(actor, lead) && !managerCanTakeAndStart) {
          return { error: "FORBIDDEN_STATUS" };
        }

        if (isManager && isManagerOwnLead && lead.status === "in_progress" && nextStatus === "new") {
          return { error: "MANAGER_CANNOT_RESET" };
        }

        if (lead.status !== nextStatus) {
          lead.status = nextStatus;
          statusChanged = true;
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
        if (actor.role === ROLE_MANAGER && lead.assigneeId !== actor.id) {
          return { error: "FORBIDDEN_NOTE" };
        }
        if (lead.internalNote !== nextInternalNote) {
          lead.internalNote = nextInternalNote;
          changed = true;
        }
      }

      if (hasOutcome) {
        if (isManager && nextOutcome !== "success") {
          return { error: "MANAGER_CANNOT_SET_FAILURE" };
        }
        if (lead.outcome !== nextOutcome) {
          lead.outcome = nextOutcome;
          changed = true;
        }
      }

      if (hasDepartment || hasAssigneeId) {
        const managerSelfTakeOnly = isManagerSelfTakeRequest && !hasDepartment;
        if (!canAssignLeads(actor) && !managerSelfTakeOnly) {
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
            const canAssignThisUser =
              (managerSelfTakeOnly && targetAssigneeId === actor.id) ||
              canAssignTargetUser(actor, assigneeUser);
            if (!canAssignThisUser) {
              return { error: "FORBIDDEN_ASSIGNEE" };
            }
            targetAssigneeName = assigneeUser.name;
            if (!hasDepartment || assigneeUser.department !== targetDepartment) {
              targetDepartment = assigneeUser.department;
            }
          }
        }

        if (!canManageTargetDepartment(actor, targetDepartment) && !managerSelfTakeOnly) {
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

      if (isManager && lead.assigneeId === actor.id && lead.status === "done" && !hasOutcome && lead.outcome !== "success") {
        lead.outcome = "success";
        changed = true;
      }

      const effectiveStatus = lead.status;
      const effectiveNote = hasInternalNote ? nextInternalNote : lead.internalNote;
      const effectiveOutcome = lead.outcome;
      if (isManager && lead.assigneeId === actor.id && effectiveStatus === "done") {
        if (!effectiveNote || effectiveNote.length < 8) {
          return { error: "MANAGER_REASON_REQUIRED" };
        }
        if (effectiveOutcome !== "success") {
          return { error: "MANAGER_SUCCESS_REQUIRED" };
        }
      }

      if (statusChanged) {
        if (lead.status === "done") {
          lead.completedAt = new Date().toISOString();
          lead.completedById = actor.id;
          lead.completedByName = actor.name;
          changed = true;
        } else {
          if (lead.completedAt || lead.completedById || lead.completedByName) {
            lead.completedAt = "";
            lead.completedById = "";
            lead.completedByName = "";
            changed = true;
          }
          if (!hasOutcome && lead.outcome !== "pending") {
            lead.outcome = "pending";
            changed = true;
          }
        }
      }

      if (!changed) {
        const events = syncImportantEventsForAllLeads(data);
        const leadEventsMap = getLeadEventsMap(events);
        return { ok: true, lead: attachLeadEvents(lead, leadEventsMap) };
      }

      lead.updatedAt = new Date().toISOString();
      lead.updatedById = actor.id;
      lead.updatedByName = actor.name;
      data.leads[index] = lead;
      const events = syncImportantEventsForAllLeads(data);
      const leadEventsMap = getLeadEventsMap(events);
      return { ok: true, lead: attachLeadEvents(lead, leadEventsMap) };
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
        code === "FORBIDDEN_DEPARTMENT" ||
        code === "MANAGER_CANNOT_RESET" ||
        code === "MANAGER_CANNOT_UNASSIGN" ||
        code === "MANAGER_CANNOT_SET_FAILURE" ||
        code === "MANAGER_CANNOT_TAKE_ASSIGNED"
      ) {
        sendJson(res, 403, { error: code });
        return;
      }
      if (
        code === "ASSIGNEE_NOT_FOUND" ||
        code === "MANAGER_REASON_REQUIRED" ||
        code === "MANAGER_SUCCESS_REQUIRED" ||
        code === "INVALID_OUTCOME"
      ) {
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
  } else if (pathname === "/admin-events") {
    pathname = "/admin-events.html";
  } else if (pathname === "/admin-training") {
    pathname = "/admin-training.html";
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

async function startServer() {
  try {
    await runStartupMigrations();
  } catch (error) {
    console.error("Startup migration failed:", error && error.message ? error.message : error);
  }

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
}

startServer();
