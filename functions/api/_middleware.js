const MAX_BODY_SIZE = 1024 * 1024;
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
const BIRTHDAY_KEYWORD_RE = /(?:день\s*рожд(?:ения|енье)?|д\.?\s*р\.?|birthday|bday)/giu;
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
const ADMIN_AUTH_DISABLED = true;
const RECOVERY_ADMIN_PASSWORD = "MyStrongAdminPass_2026";

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
    keywords: ["ребенок", "ребенок", "дети", "детей", "child", "children"]
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
    keywords: ["теща", "теша", "свекровь", "mother-in-law", "mother in law"]
  },
  {
    relation: "father_in_law",
    title: "День рождения тестя или свекра клиента",
    keywords: ["тесть", "свекор", "свекор", "father-in-law", "father in law"]
  },
  {
    relation: "aunt",
    title: "День рождения тети клиента",
    keywords: ["тетя", "тети", "aunt"]
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
    keywords: ["крестная", "godmother"]
  },
  {
    relation: "godfather",
    title: "День рождения крестного клиента",
    keywords: ["крестный", "godfather"]
  },
  {
    relation: "partner",
    title: "День рождения партнера клиента",
    keywords: ["партнер", "девушка", "парень", "fiance", "fiancee", "partner"]
  }
];

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
  if (ADMIN_ROLES.has(role)) return role;
  if (LEGACY_ROLE_ALIASES.has(role)) return ROLE_MANAGER;
  return ROLE_MANAGER;
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

const createDefaultPerformanceData = () => ({
  plans: {
    day: { target: 0, updatedAt: "", updatedById: "", updatedByName: "" },
    week: { target: 0, updatedAt: "", updatedById: "", updatedByName: "" },
    month: { target: 0, updatedAt: "", updatedById: "", updatedByName: "" }
  },
  trainingAssignments: []
});

const initData = () => ({
  visits: { totalHits: 0, uniqueVisitors: 0, knownVisitors: {}, byDay: {} },
  engagement: { totalDurationMs: 0, samplesCount: 0, byPage: {} },
  secrets: { totalEvents: 0, bySecret: {}, byVisitor: {} },
  leads: [],
  crm: { importantEvents: [] },
  training: { profiles: [], callReviews: [] },
  performance: createDefaultPerformanceData()
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

const normIsoDate = (value) => {
  const raw = clean(value, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
};

const normMonthDay = (value) => {
  const raw = clean(value, 10);
  return /^\d{2}-\d{2}$/.test(raw) ? raw : "";
};

const clampInt = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
};

const normLeadOutcome = (value) => {
  const outcome = clean(value, 20).toLowerCase();
  return LEAD_OUTCOMES.has(outcome) ? outcome : "pending";
};

function normLeadComment(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const text = clean(source.text, 2000);
  if (!text) return null;
  const createdAt = clean(source.createdAt, 64) || new Date().toISOString();
  const idSeed = clean(source.id, 120) || `${createdAt}_${index}_${text.slice(0, 24)}`;
  const id = clean(source.id, 120) || `cmt_${b64u(enc.encode(idSeed)).slice(0, 16)}`;
  const authorId = normUid(source.authorId, "");
  const authorUsername = normUid(source.authorUsername, "") || (authorId !== "workspace" ? authorId : "");
  return {
    id,
    text,
    authorId,
    authorUsername,
    authorName: clean(source.authorName, 120) || "Менеджер",
    authorRole: clean(source.authorRole, 20).toLowerCase(),
    createdAt
  };
}

const normTrainingStatus = (value) => {
  const raw = clean(value, 30).toLowerCase();
  return TRAINING_STATUSES.has(raw) ? raw : "onboarding";
};

const normTrainingStage = (value) => {
  const raw = clean(value, 40).toLowerCase();
  return TRAINING_STAGES.has(raw) ? raw : "foundation";
};

const normTrainingChannel = (value) => {
  const raw = clean(value, 20).toLowerCase();
  return TRAINING_REVIEW_CHANNELS.has(raw) ? raw : "call";
};

function normTrainingRedFlags(input) {
  const list = Array.isArray(input) ? input : [];
  const dedup = new Set();
  list.forEach((item) => {
    const flag = clean(item, 40).toLowerCase();
    if (flag && TRAINING_REVIEW_RED_FLAGS.has(flag)) {
      dedup.add(flag);
    }
  });
  return Array.from(dedup);
}

function resolveTrainingStageByDay(day) {
  if (day >= 24) return "closing";
  if (day >= 16) return "dialog_control";
  if (day >= 8) return "diagnostics";
  return "foundation";
}

function normTrainingProfile(input) {
  const source = input && typeof input === "object" ? input : {};
  const userId = normUid(source.userId, "");
  if (!userId) return null;
  const createdAt = clean(source.createdAt, 64) || new Date().toISOString();
  const updatedAt = clean(source.updatedAt, 64) || createdAt;
  const currentDay = clampInt(source.currentDay, 1, 30, 1);
  const hasStage = Boolean(clean(source.stage, 40));
  return {
    userId,
    planStartDate: normIsoDate(source.planStartDate),
    currentDay,
    stage: hasStage ? normTrainingStage(source.stage) : resolveTrainingStageByDay(currentDay),
    status: normTrainingStatus(source.status),
    confidence: clampInt(source.confidence, 1, 5, 3),
    energy: clampInt(source.energy, 1, 5, 3),
    control: clampInt(source.control, 1, 5, 3),
    notes: clean(source.notes, 2400),
    createdAt,
    updatedAt,
    updatedById: normUid(source.updatedById, ""),
    updatedByName: clean(source.updatedByName, 120)
  };
}

function normTrainingCallReview(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const userId = normUid(source.userId, "");
  if (!userId) return null;
  const createdAt = clean(source.createdAt, 64) || new Date().toISOString();
  const idSeed = clean(source.id, 120) || `${userId}_${createdAt}_${index}`;
  const id = clean(source.id, 120) || `rev_${b64u(enc.encode(idSeed)).slice(0, 18)}`;
  const start = clampInt(source.start, 0, 15, 0);
  const diagnostics = clampInt(source.diagnostics, 0, 25, 0);
  const presentation = clampInt(source.presentation, 0, 20, 0);
  const objections = clampInt(source.objections, 0, 15, 0);
  const closing = clampInt(source.closing, 0, 15, 0);
  const crm = clampInt(source.crm, 0, 10, 0);
  const totalScore = start + diagnostics + presentation + objections + closing + crm;
  return {
    id,
    userId,
    reviewerId: normUid(source.reviewerId, ""),
    reviewerName: clean(source.reviewerName, 120) || "Руководитель",
    channel: normTrainingChannel(source.channel),
    start,
    diagnostics,
    presentation,
    objections,
    closing,
    crm,
    totalScore: clampInt(totalScore, 0, 100, 0),
    redFlags: normTrainingRedFlags(source.redFlags),
    confidence: clampInt(source.confidence, 1, 5, 3),
    energy: clampInt(source.energy, 1, 5, 3),
    control: clampInt(source.control, 1, 5, 3),
    comment: clean(source.comment, 2000),
    createdAt
  };
}

function normTrainingData(input) {
  const source = input && typeof input === "object" ? input : {};
  const profiles = Array.isArray(source.profiles)
    ? source.profiles.map((item) => normTrainingProfile(item)).filter(Boolean)
    : [];
  const callReviews = Array.isArray(source.callReviews)
    ? source.callReviews.map((item, index) => normTrainingCallReview(item, index)).filter(Boolean)
    : [];
  return { profiles, callReviews };
}

const normPlanTarget = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100000, Math.round(numeric)));
};

const normPlanEntry = (input) => {
  const source = input && typeof input === "object" ? input : {};
  return {
    target: normPlanTarget(source.target),
    updatedAt: clean(source.updatedAt, 64),
    updatedById: normUid(source.updatedById, ""),
    updatedByName: clean(source.updatedByName, 120)
  };
};

function normTrainingAssignment(input, index = 0) {
  const source = input && typeof input === "object" ? input : {};
  const userId = normUid(source.userId, "");
  if (!userId) return null;
  const updatedAt = clean(source.updatedAt, 64) || clean(source.assignedAt, 64);
  const idSeed = clean(source.id, 120) || `${userId}_${updatedAt || index}`;
  return {
    id: clean(source.id, 120) || `tas_${b64u(enc.encode(idSeed)).slice(0, 16)}`,
    userId,
    assigned: Boolean(source.assigned),
    note: clean(source.note, 1200),
    assignedAt: clean(source.assignedAt, 64),
    assignedById: normUid(source.assignedById, ""),
    assignedByName: clean(source.assignedByName, 120),
    updatedAt,
    updatedById: normUid(source.updatedById, ""),
    updatedByName: clean(source.updatedByName, 120)
  };
}

function normPerformanceData(input) {
  const source = input && typeof input === "object" ? input : {};
  const defaults = createDefaultPerformanceData();
  const plansIn = source.plans && typeof source.plans === "object" ? source.plans : {};
  const assignmentsIn = Array.isArray(source.trainingAssignments) ? source.trainingAssignments : [];
  const dedupByUser = new Map();
  assignmentsIn.forEach((item, index) => {
    const assignment = normTrainingAssignment(item, index);
    if (assignment) dedupByUser.set(assignment.userId, assignment);
  });
  return {
    plans: {
      day: normPlanEntry(plansIn.day || defaults.plans.day),
      week: normPlanEntry(plansIn.week || defaults.plans.week),
      month: normPlanEntry(plansIn.month || defaults.plans.month)
    },
    trainingAssignments: Array.from(dedupByUser.values())
  };
}

function normImportantEvent(input) {
  const source = input && typeof input === "object" ? input : {};
  const id = clean(source.id, 120);
  const leadId = clean(source.leadId, 120);
  if (!id || !leadId) return null;
  const createdAt = clean(source.createdAt, 64) || new Date().toISOString();
  const updatedAt = clean(source.updatedAt, 64) || createdAt;
  return {
    id,
    leadId,
    type: clean(source.type, 40).toLowerCase() || "birthday",
    relation: clean(source.relation, 40).toLowerCase() || "client",
    title: clean(source.title, 120) || "Важное событие",
    eventDate: normIsoDate(source.eventDate),
    monthDay: normMonthDay(source.monthDay),
    nextOccurrence: normIsoDate(source.nextOccurrence),
    sourceText: clean(source.sourceText, 260),
    source: clean(source.source, 40) || "auto",
    clientName: clean(source.clientName, 120),
    clientContact: clean(source.clientContact, 140),
    createdAt,
    updatedAt
  };
}

function normCrmData(input) {
  const source = input && typeof input === "object" ? input : {};
  const importantEvents = Array.isArray(source.importantEvents)
    ? source.importantEvents.map((item) => normImportantEvent(item)).filter(Boolean)
    : [];
  return { importantEvents };
}

function normLead(input) {
  const source = input && typeof input === "object" ? input : {};
  const seed = clean(source.createdAt, 64) || clean(source.name, 40) || "legacy";
  const fallbackId = `lead_legacy_${b64u(enc.encode(seed)).slice(0, 12)}`;
  const comments = Array.isArray(source.comments)
    ? source.comments.map((comment, index) => normLeadComment(comment, index)).filter(Boolean)
    : [];
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
    outcome: normLeadOutcome(source.outcome),
    internalNote: clean(source.internalNote, 2000),
    updatedById: normUid(source.updatedById, ""),
    updatedByName: clean(source.updatedByName, 120),
    completedAt: clean(source.completedAt, 64),
    completedById: normUid(source.completedById, ""),
    completedByName: clean(source.completedByName, 120),
    comments,
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
    leads: Array.isArray(base.leads) ? base.leads.map((lead) => normLead(lead)) : [],
    crm: normCrmData(base.crm),
    training: normTrainingData(base.training),
    performance: normPerformanceData(base.performance)
  };
}

const pubUser = (user) => ({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  department: user.department
});

const rolePerms = (role, options = {}) => {
  const isOwner = role === ROLE_OWNER;
  const isProduct = role === ROLE_PRODUCT;
  const isManager = role === ROLE_MANAGER;
  const fallbackTrainingAccess = isOwner || isProduct;
  const canAccessTraining =
    typeof options.canAccessTraining === "boolean"
      ? options.canAccessTraining
      : fallbackTrainingAccess;
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
    canAccessTraining
  };
};

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
      id: "product_lead",
      username: String(env.PRODUCT_LOGIN || "product_lead"),
      password: String(env.PRODUCT_PASSWORD || "change-product"),
      name: "Product Lead",
      role: ROLE_PRODUCT,
      department: "sales"
    },
    {
      id: "manager_main",
      username: String(env.MANAGER_LOGIN || "manager_main"),
      password: String(env.MANAGER_PASSWORD || "change-manager"),
      name: "Manager Main",
      role: ROLE_MANAGER,
      department: "sales"
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
    if (LEGACY_SYSTEM_USER_IDS.has(user.id)) continue;
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

const canViewStats = (actor) =>
  Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT || actor.role === ROLE_MANAGER));
const canAssign = (actor) => Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT));
const canManageUsers = (actor) => Boolean(actor && actor.role === ROLE_OWNER);
const canManagePlans = (actor) => Boolean(actor && actor.role === ROLE_OWNER);

function canReadLead(actor, lead) {
  if (!actor || !lead) return false;
  if (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT || actor.role === ROLE_MANAGER) return true;
  return false;
}

const canManageTargetDept = (actor, dept) =>
  actor && (actor.role === ROLE_OWNER || (actor.role === ROLE_PRODUCT && dept === actor.department));
const canAssignTargetUser = (actor, user) =>
  actor &&
  user &&
  (actor.role === ROLE_OWNER || (actor.role === ROLE_PRODUCT && user.department === actor.department));
const canUpdateStatus = (actor, lead) =>
  actor &&
  lead &&
  (actor.role === ROLE_OWNER ||
    actor.role === ROLE_PRODUCT ||
    (actor.role === ROLE_MANAGER && lead.assigneeId === actor.id));

function ensurePerformanceStorage(data) {
  const normalized = normPerformanceData(data?.performance);
  data.performance = normalized;
  return normalized;
}

function ensureTrainingStorage(data) {
  const normalized = normTrainingData(data?.training);
  data.training = normalized;
  return normalized;
}

function ensureCrmStorage(data) {
  const normalized = normCrmData(data?.crm);
  data.crm = normalized;
  return normalized;
}

function getTrainingAssignmentEntry(performance, userId) {
  const safeUserId = normUid(userId, "");
  if (!safeUserId) return null;
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
  if (!actor) return false;
  if (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT) return true;
  if (actor.role === ROLE_MANAGER) return Boolean(data && isTrainingAssignedForUser(data, actor.id));
  return false;
}

function canManageTrainingAssignments(actor) {
  return Boolean(actor && (actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT));
}

function canReadTrainingProfile(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (actor.role === ROLE_OWNER) return true;
  if (actor.role === ROLE_PRODUCT) return actor.department === targetUser.department;
  return actor.id === targetUser.id;
}

function canManageTrainingProfile(actor, targetUser) {
  if (!actor || !targetUser) return false;
  if (actor.role === ROLE_OWNER) return true;
  if (actor.role === ROLE_PRODUCT) return actor.department === targetUser.department;
  return false;
}

function canManageTrainingAssignmentTarget(actor, targetUser) {
  if (!canManageTrainingAssignments(actor) || !targetUser) return false;
  if (targetUser.role !== ROLE_MANAGER) return false;
  if (actor.role === ROLE_OWNER) return true;
  if (actor.role === ROLE_PRODUCT) return targetUser.department === actor.department;
  return false;
}

function getManageableTrainingManagers(actor, users) {
  if (!canManageTrainingAssignments(actor)) return [];
  return users
    .filter((user) => canManageTrainingAssignmentTarget(actor, user))
    .map((user) => pubUser(user))
    .sort((left, right) => {
      const leftName = left.name || left.username || left.id;
      const rightName = right.name || right.username || right.id;
      return String(leftName).localeCompare(String(rightName), "ru");
    });
}

function getTrainingAssignmentsPayload(actor, data, users) {
  const performance = ensurePerformanceStorage(data);
  const managers = getManageableTrainingManagers(actor, users);
  return managers.map((user) => ({
    user,
    assignment: toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, user.id))
  }));
}

function permsForActor(actor, data) {
  if (!actor) return rolePerms("", { canAccessTraining: false });
  return rolePerms(actor.role, { canAccessTraining: canAccessTrainingPanel(actor, data) });
}

function daysInMonthUtc(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeYearPart(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric >= 1000 && numeric <= 9999) return numeric;
  if (numeric >= 0 && numeric <= 99) return numeric <= 40 ? 2000 + numeric : 1900 + numeric;
  return null;
}

function parseDateToken(token) {
  const raw = clean(token, 30);
  if (!raw) return null;
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const year = normalizeYearPart(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!year || month < 1 || month > 12) return null;
    if (day < 1 || day > daysInMonthUtc(year, month)) return null;
    return { year, month, day, hasYear: true };
  }
  const classicMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (!classicMatch) return null;
  const day = Number(classicMatch[1]);
  const month = Number(classicMatch[2]);
  const year = classicMatch[3] ? normalizeYearPart(classicMatch[3]) : null;
  if (month < 1 || month > 12 || day < 1) return null;
  const maxDay = year ? daysInMonthUtc(year, month) : daysInMonthUtc(2000, month);
  if (day > maxDay) return null;
  return { year, month, day, hasYear: Boolean(year) };
}

function toIsoDateUtc(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function computeNextOccurrenceIso(month, day, nowDate = new Date()) {
  if (!Number.isFinite(month) || !Number.isFinite(day) || month < 1 || month > 12 || day < 1) return "";
  const todayUtc = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
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

function hashText(value) {
  const text = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function buildImportantEventId(seed) {
  const base = String(seed || "");
  return `evt_${hashText(base)}${hashText(`x:${base}`)}`;
}

function getLeadTextForEventDetection(lead) {
  const commentsText = Array.isArray(lead?.comments)
    ? lead.comments.map((item) => clean(item?.text, 400)).filter(Boolean).join(" ")
    : "";
  return [
    clean(lead?.message, 2200),
    clean(lead?.internalNote, 2200),
    clean(lead?.contact, 220),
    clean(lead?.name, 160),
    commentsText
  ]
    .filter(Boolean)
    .join(" ");
}

function normalizeKeywordText(value) {
  return String(value || "").toLowerCase().replace(/\u0451/g, "\u0435");
}

function detectBirthdayRelation(context) {
  const source = normalizeKeywordText(context);
  if (!source) {
    return { relation: "client", title: "День рождения клиента" };
  }
  for (const rule of BIRTHDAY_RELATIVE_KEYWORDS) {
    const keywords = Array.isArray(rule.keywords) ? rule.keywords : [];
    const matched = keywords.some((keyword) => source.includes(normalizeKeywordText(keyword)));
    if (matched) {
      return { relation: rule.relation, title: rule.title };
    }
  }
  return { relation: "client", title: "День рождения клиента" };
}

function extractImportantEventsFromLead(lead) {
  const text = getLeadTextForEventDetection(lead);
  if (!text) return [];
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
    const eventDate =
      parsedDate && parsedDate.hasYear
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
      normImportantEvent({
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
    if (!dedup.has(event.id)) dedup.set(event.id, event);
  });
  return Array.from(dedup.values());
}

function sortImportantEvents(events) {
  return [...events].sort((left, right) => {
    const leftKey = left.nextOccurrence || "9999-12-31";
    const rightKey = right.nextOccurrence || "9999-12-31";
    if (leftKey !== rightKey) return leftKey.localeCompare(rightKey);
    return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
  });
}

function syncImportantEventsForAllLeads(data) {
  const crm = ensureCrmStorage(data);
  const existing = Array.isArray(crm.importantEvents) ? crm.importantEvents : [];
  const leads = Array.isArray(data.leads) ? data.leads.map((item) => normLead(item)) : [];
  data.leads = leads;
  const nowIso = new Date().toISOString();
  const previousAutoById = new Map(
    existing.filter((event) => event && event.source === "auto").map((event) => [event.id, event])
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
    if (!event || !event.leadId) return;
    if (!map.has(event.leadId)) map.set(event.leadId, []);
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
  if (!isoDate) return null;
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const target = Date.UTC(year, month - 1, day);
  const today = Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate());
  return Math.floor((target - today) / DAY_MS);
}

function sortTrainingProfiles(profiles) {
  const statusOrder = { onboarding: 0, active: 1, paused: 2, certified: 3 };
  return [...profiles].sort((left, right) => {
    const leftStatus = statusOrder[left.status] ?? 99;
    const rightStatus = statusOrder[right.status] ?? 99;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;
    if (left.currentDay !== right.currentDay) return right.currentDay - left.currentDay;
    return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
  });
}

function ensureTrainingProfileForUser(training, userId, nowIso = new Date().toISOString()) {
  const safeUserId = normUid(userId, "");
  if (!safeUserId) return null;
  const existing = training.profiles.find((item) => item.userId === safeUserId);
  if (existing) return existing;
  const created = normTrainingProfile({
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
  if (!created) return null;
  training.profiles.push(created);
  return created;
}

function getTrainingReviewsByUser(reviews, visibleUserIds) {
  const map = new Map();
  const list = Array.isArray(reviews) ? reviews : [];
  const allowed = visibleUserIds instanceof Set ? visibleUserIds : null;
  list.forEach((item) => {
    if (!item || !item.userId) return;
    if (allowed && !allowed.has(item.userId)) return;
    if (!map.has(item.userId)) map.set(item.userId, []);
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
  if (avgScore >= 90 && reviewCount >= 4) return "leader";
  if (avgScore >= 75 && reviewCount >= 2) return "boost";
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
  return { ...summary, user };
}

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

function leadCompletionTs(lead) {
  const ts = Date.parse(String(lead?.completedAt || lead?.updatedAt || lead?.createdAt || ""));
  return Number.isFinite(ts) ? ts : NaN;
}

function periodWindowStartMs(period, nowMs) {
  if (period === "day") return nowMs - DAY_MS;
  if (period === "week") return nowMs - 7 * DAY_MS;
  return nowMs - 30 * DAY_MS;
}

function scoreLead(lead) {
  if (!lead || lead.status !== "done") return 0;
  if (lead.outcome === "success") return 6;
  if (lead.outcome === "failure") return 2;
  return 0;
}

function buildSalesPeriods(leads, plans, nowDate = new Date()) {
  const list = Array.isArray(leads) ? leads : [];
  const nowMs = nowDate.getTime();
  const out = {};
  SALES_PLAN_PERIODS.forEach((period) => {
    const windowStart = periodWindowStartMs(period, nowMs);
    let total = 0;
    let processed = 0;
    let success = 0;
    let failure = 0;
    list.forEach((lead) => {
      const createdTs = Date.parse(String(lead?.createdAt || ""));
      if (Number.isFinite(createdTs) && createdTs >= windowStart) {
        total += 1;
      }
      const completedTs = leadCompletionTs(lead);
      if (Number.isFinite(completedTs) && completedTs >= windowStart && lead.status === "done") {
        processed += 1;
        if (lead.outcome === "success") success += 1;
        if (lead.outcome === "failure") failure += 1;
      }
    });
    const planTarget = Number(plans?.[period]?.target) || 0;
    const planCompletionPercent = planTarget > 0 ? Math.round((success / planTarget) * 1000) / 10 : 0;
    out[period] = {
      total,
      processed,
      success,
      failure,
      planTarget,
      planCompletionPercent,
      points: success * 6 + failure * 2
    };
  });
  return out;
}

function buildManagerPerformance(leads, plans, users, nowDate = new Date()) {
  const list = Array.isArray(leads) ? leads : [];
  const managers = Array.isArray(users) ? users.filter((user) => user.role === ROLE_MANAGER) : [];
  const nowMs = nowDate.getTime();

  const rows = managers.map((user) => {
    const assigned = list.filter((lead) => lead.assigneeId === user.id);
    const periods = {};
    SALES_PLAN_PERIODS.forEach((period) => {
      const windowStart = periodWindowStartMs(period, nowMs);
      let processed = 0;
      let success = 0;
      let failure = 0;
      assigned.forEach((lead) => {
        const completedTs = leadCompletionTs(lead);
        if (!Number.isFinite(completedTs) || completedTs < windowStart) return;
        if (lead.status !== "done") return;
        processed += 1;
        if (lead.outcome === "success") success += 1;
        if (lead.outcome === "failure") failure += 1;
      });
      const planTarget = Number(plans?.[period]?.target) || 0;
      const planCompletionPercent = planTarget > 0 ? Math.round((success / planTarget) * 1000) / 10 : 0;
      periods[period] = {
        processed,
        success,
        failure,
        planTarget,
        planCompletionPercent,
        points: success * 6 + failure * 2
      };
    });
    const totals = {
      points: assigned.reduce((acc, lead) => acc + scoreLead(lead), 0),
      processed: assigned.filter((lead) => lead.status === "done").length
    };
    return {
      user: pubUser(user),
      userId: user.id,
      periods,
      totals
    };
  });

  const sorted = [...rows].sort((left, right) => {
    const leftMonthPoints = Number(left?.periods?.month?.points) || 0;
    const rightMonthPoints = Number(right?.periods?.month?.points) || 0;
    if (leftMonthPoints !== rightMonthPoints) return rightMonthPoints - leftMonthPoints;
    const leftMonthSuccess = Number(left?.periods?.month?.success) || 0;
    const rightMonthSuccess = Number(right?.periods?.month?.success) || 0;
    if (leftMonthSuccess !== rightMonthSuccess) return rightMonthSuccess - leftMonthSuccess;
    return String(left?.user?.name || left?.user?.username || left?.userId || "").localeCompare(
      String(right?.user?.name || right?.user?.username || right?.userId || ""),
      "ru"
    );
  });

  sorted.forEach((row, index) => {
    row.rank = index + 1;
  });

  const leaderboard = sorted.map((row) => ({
    rank: row.rank,
    user: row.user,
    userId: row.userId,
    periods: row.periods,
    totals: row.totals
  }));

  return { rows: sorted, leaderboard };
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
  !actor
    ? [DEFAULT_DEPARTMENT]
    : actor.role === ROLE_OWNER || actor.role === ROLE_PRODUCT
      ? knownDepts(data, users)
      : [actor.department];

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
  if (actor.role === ROLE_PRODUCT) {
    return users.filter((user) => user.role !== ROLE_OWNER).map((user) => pubUser(user));
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
      return mutateState(env, ({ data }) => {
        data.leads.unshift(lead);
        if (data.leads.length > 5000) data.leads.length = 5000;
        syncImportantEventsForAllLeads(data);
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
        permissions: permsForActor(actor, state.data)
      });
    }

    if (pathname === "/api/admin/me" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      return json(200, { ok: true, actor, permissions: permsForActor(actor, state.data) });
    }

    if (pathname === "/api/admin/team" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      const permissions = permsForActor(actor, state.data);
      const performance = ensurePerformanceStorage(state.data);
      const assignment = toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, actor.id));
      const trainingAssignments = permissions.canManageTrainingAssignments
        ? getTrainingAssignmentsPayload(actor, state.data, state.users)
        : [];
      return json(200, {
        ok: true,
        actor,
        permissions,
        users: visibleUsers(actor, state.users, ctx),
        departments: visibleDepts(actor, state.data, state.users),
        trainingAccess: permissions.canAccessTraining,
        trainingAssignment: assignment,
        trainingAssignments
      });
    }

    if (pathname === "/api/admin/plans" && method === "PATCH") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const getTargetValue = (period) => {
        const directKey = `${period}Target`;
        if (Object.prototype.hasOwnProperty.call(body, directKey)) return body[directKey];
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
      if (targets.day === undefined && targets.week === undefined && targets.month === undefined) {
        return json(400, { error: "NO_UPDATABLE_FIELDS" });
      }
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        if (!canManagePlans(actor)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_PLANS" }) };
        }
        const performance = ensurePerformanceStorage(data);
        const nowIso = new Date().toISOString();
        SALES_PLAN_PERIODS.forEach((period) => {
          if (targets[period] === undefined) return;
          performance.plans[period] = {
            target: normPlanTarget(targets[period]),
            updatedAt: nowIso,
            updatedById: actor.id,
            updatedByName: actor.name
          };
        });
        data.performance = performance;
        return {
          result: json(200, {
            ok: true,
            plans: performance.plans
          })
        };
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
        const password = String(body.password || "").trim().slice(0, 200);
        const name = clean(body.name, 120) || username;
        const department = normDept(body.department);
        const requestedRole = normRole(body.role);
        const role = requestedRole === ROLE_OWNER ? ROLE_MANAGER : requestedRole;
        if (!username || !password) {
          return { noWrite: true, result: json(400, { error: "USERNAME_PASSWORD_REQUIRED" }) };
        }
        if (ctx.byUsername.has(username)) {
          return { noWrite: true, result: json(400, { error: "USERNAME_TAKEN" }) };
        }
        const requestedId = normUid(body.id, `${role}_${username}`);
        let id = requestedId;
        let suffix = 1;
        while (ctx.byId.has(id)) {
          id = `${requestedId}_${suffix}`;
          suffix += 1;
        }
        const user = { id, username, password, name, role, department };
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
        const hasRole = Object.prototype.hasOwnProperty.call(body, "role");
        if (!hasUsername && !canUpdatePassword && !hasName && !hasDepartment && !hasRole) {
          return { noWrite: true, result: json(400, { error: "NO_UPDATABLE_FIELDS" }) };
        }
        const nextUsername = hasUsername ? normUid(body.username, "") : target.username;
        const nextPassword = canUpdatePassword
          ? String(body.password || "").trim().slice(0, 200)
          : target.password;
        const nextName = hasName ? clean(body.name, 120) || target.name : target.name;
        const nextDepartment = hasDepartment ? normDept(body.department) : target.department;
        const requestedRole = hasRole ? normRole(body.role) : target.role;
        const nextRole = requestedRole === ROLE_OWNER ? ROLE_MANAGER : requestedRole;
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
        target.role = nextRole;
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
      const permissions = permsForActor(actor, state.data);
      const today = dayKey();
      const todayEntry = normDayEntry(state.data.visits.byDay[today]);
      const engagement = normEngData(state.data.engagement);
      const secrets = normSecrets(state.data.secrets);
      const leads = Array.isArray(state.data.leads) ? state.data.leads.map((lead) => normLead(lead)) : [];
      const performance = ensurePerformanceStorage(state.data);
      const plans = performance.plans;
      const now = new Date();
      const periods = buildSalesPeriods(leads, plans, now);
      const managerPerformanceRaw = buildManagerPerformance(leads, plans, state.users, now);
      const actorDepartment = String(actor.department || "");
      const rowsByScope =
        actor.role === ROLE_OWNER
          ? managerPerformanceRaw.rows
          : actor.role === ROLE_PRODUCT
            ? managerPerformanceRaw.rows.filter((row) => row.user?.department === actorDepartment)
            : managerPerformanceRaw.rows.filter((row) => row.userId === actor.id);
      const leaderboardByScope =
        actor.role === ROLE_OWNER
          ? managerPerformanceRaw.leaderboard
          : actor.role === ROLE_PRODUCT
            ? managerPerformanceRaw.leaderboard.filter((row) => row.user?.department === actorDepartment)
            : managerPerformanceRaw.leaderboard;
      const pointsThisMonth = rowsByScope.reduce(
        (acc, row) => acc + (Number(row?.periods?.month?.points) || 0),
        0
      );
      const pointsTotal = rowsByScope.reduce((acc, row) => acc + (Number(row?.totals?.points) || 0), 0);
      const leadsProcessed = leads.filter((lead) => lead.status === "done").length;
      const leadsSuccess = leads.filter((lead) => lead.status === "done" && lead.outcome === "success").length;
      const leadsFailure = leads.filter((lead) => lead.status === "done" && lead.outcome === "failure").length;
      const leadSuccessRatePercent =
        leadsProcessed > 0 ? Math.round((leadsSuccess / leadsProcessed) * 1000) / 10 : 0;
      const uniqueVisitorsInDays = (daysCount) => {
        const bucket = {};
        for (let i = 0; i < daysCount; i += 1) {
          const date = new Date(now);
          date.setUTCDate(now.getUTCDate() - i);
          const key = dayKey(date);
          const entry = normDayEntry(state.data.visits.byDay[key]);
          const visitors = entry.visitors && typeof entry.visitors === "object" ? entry.visitors : {};
          Object.keys(visitors).forEach((visitorId) => {
            if (visitorId) bucket[visitorId] = true;
          });
        }
        return Object.keys(bucket).length;
      };
      const uniqueVisitors7d = uniqueVisitorsInDays(7);
      const uniqueVisitors30d = uniqueVisitorsInDays(30);
      const secretHunters = Object.values(secrets.byVisitor || {}).filter((entry) => {
        const uniq = entry && entry.uniqueSecrets && typeof entry.uniqueSecrets === "object"
          ? Object.keys(entry.uniqueSecrets)
          : [];
        return uniq.length > 0;
      }).length;
      const secretHuntersPercent =
        state.data.visits.uniqueVisitors > 0
          ? Math.round((secretHunters / state.data.visits.uniqueVisitors) * 1000) / 10
          : 0;
      return json(200, {
        totalHits: state.data.visits.totalHits,
        uniqueVisitors: state.data.visits.uniqueVisitors,
        uniqueVisitors7d,
        uniqueVisitors30d,
        today: { date: today, hits: todayEntry.hits, uniqueVisitors: todayEntry.uniqueVisitors },
        todayUniqueVisitors: todayEntry.uniqueVisitors,
        todayRepeatVisits: Math.max(0, todayEntry.hits - todayEntry.uniqueVisitors),
        last7Days: lastDays(state.data.visits.byDay, 7),
        leadsTotal: leads.length,
        leadsNew: leads.filter((lead) => lead.status === "new").length,
        leadsUnassigned: leads.filter((lead) => !lead.assigneeId).length,
        leadsProcessed,
        leadsSuccess,
        leadsFailure,
        leadSuccessRatePercent,
        avgViewMs:
          engagement.samplesCount > 0 ? Math.round(engagement.totalDurationMs / engagement.samplesCount) : 0,
        secretFindsTotal: secrets.totalEvents,
        avgSecretsPerVisitor: 0,
        secretHunters,
        secretHuntersPercent,
        pointsThisMonth,
        pointsTotal,
        plans,
        periods,
        managerPerformance: {
          rows: rowsByScope,
          leaderboard: leaderboardByScope
        },
        actor,
        permissions,
        training: {
          canAccess: permissions.canAccessTraining
        }
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
      const permissions = permsForActor(actor, state.data);
      const events = syncImportantEventsForAllLeads(state.data);
      const leadEventsMap = getLeadEventsMap(events);
      const leads = (Array.isArray(state.data.leads) ? state.data.leads : [])
        .map((lead) => normLead(lead))
        .filter((lead) => canReadLead(actor, lead))
        .map((lead) => attachLeadEvents(lead, leadEventsMap));
      return json(200, {
        leads: leads.slice(offset, offset + limit),
        total: leads.length,
        offset,
        limit,
        actor,
        permissions
      });
    }

    if (
      pathname.startsWith("/api/admin/leads/") &&
      pathname.endsWith("/comments") &&
      method === "POST"
    ) {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const basePath = "/api/admin/leads/";
      const suffix = "/comments";
      const encodedLeadId = pathname.slice(basePath.length, pathname.length - suffix.length);
      const id = decodePath(encodedLeadId || "");
      if (!id) return json(400, { error: "LEAD_ID_REQUIRED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const commentText = clean(body.text, 2000);
      if (!commentText) return json(400, { error: "COMMENT_REQUIRED" });
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const index = data.leads.findIndex((item) => normLead(item).id === id);
        if (index < 0) return { noWrite: true, result: json(404, { error: "LEAD_NOT_FOUND" }) };
        const lead = normLead(data.leads[index]);
        if (!canReadLead(actor, lead)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_COMMENT" }) };
        }
        const comment = normLeadComment(
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
        if (!comment) return { noWrite: true, result: json(400, { error: "COMMENT_REQUIRED" }) };
        lead.comments.push(comment);
        if (lead.comments.length > 300) lead.comments = lead.comments.slice(-300);
        lead.updatedAt = new Date().toISOString();
        lead.updatedById = actor.id;
        lead.updatedByName = actor.name;
        data.leads[index] = lead;
        const events = syncImportantEventsForAllLeads(data);
        const leadEventsMap = getLeadEventsMap(events);
        return {
          result: json(201, {
            ok: true,
            comment,
            lead: attachLeadEvents(lead, leadEventsMap)
          })
        };
      });
    }

    if (pathname === "/api/admin/events" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const rawLimit = Number(url.searchParams.get("limit"));
      const scope = clean(url.searchParams.get("scope"), 40).toLowerCase();
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 2000) : 500;
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const permissions = permsForActor(actor, data);
        const now = new Date();
        const leads = Array.isArray(data.leads) ? data.leads.map((lead) => normLead(lead)) : [];
        data.leads = leads;
        const events = syncImportantEventsForAllLeads(data);
        const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
        const visibleEvents = events
          .map((event) => normImportantEvent(event))
          .filter(Boolean)
          .filter((event) => {
            const lead = leadsById.get(event.leadId);
            if (!lead) return false;
            return canReadLead(actor, lead);
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
          if (scope === "today") return event.daysUntil === 0;
          if (scope === "overdue") return event.timeline === "overdue";
          if (scope === "soon") return event.timeline === "soon";
          if (scope === "upcoming") return event.timeline === "soon" || event.timeline === "upcoming";
          if (scope === "no_date") return event.timeline === "no_date";
          return true;
        });
        const sorted = filteredEvents.sort((left, right) => {
          const toSortRank = (item) => {
            if (item.daysUntil === 0) return 0;
            if (Number.isFinite(Number(item.daysUntil)) && Number(item.daysUntil) > 0) return 1;
            if (Number.isFinite(Number(item.daysUntil)) && Number(item.daysUntil) < 0) return 2;
            return 3;
          };
          const leftRank = toSortRank(left);
          const rightRank = toSortRank(right);
          if (leftRank !== rightRank) return leftRank - rightRank;
          if (leftRank === 0 || leftRank === 1) return Number(left.daysUntil) - Number(right.daysUntil);
          if (leftRank === 2) return Number(right.daysUntil) - Number(left.daysUntil);
          const leftDate = left.nextOccurrence || "9999-12-31";
          const rightDate = right.nextOccurrence || "9999-12-31";
          if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
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
        return {
          result: json(200, {
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
          })
        };
      });
    }

    if (pathname === "/api/admin/training" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const rawLimit = Number(url.searchParams.get("limit"));
      const reviewLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 400) : 100;
      const filterUserId = normUid(url.searchParams.get("userId"), "");
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const permissions = permsForActor(actor, data);
        const performance = ensurePerformanceStorage(data);
        const assignment = toPublicTrainingAssignment(getTrainingAssignmentEntry(performance, actor.id));
        const trainingAssignments = permissions.canManageTrainingAssignments
          ? getTrainingAssignmentsPayload(actor, data, users)
          : [];
        if (!permissions.canAccessTraining) {
          return {
            noWrite: true,
            result: json(403, {
              error: "TRAINING_NOT_ASSIGNED",
              actor,
              permissions,
              assignment
            })
          };
        }
        if (actor.role === ROLE_MANAGER) {
          return {
            noWrite: true,
            result: json(200, {
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
            })
          };
        }
        const training = ensureTrainingStorage(data);
        const visibleManagers = visibleUsers(actor, users, ctx)
          .filter((user) => user.role === ROLE_MANAGER)
          .filter((user) => {
            const targetUser = ctx.byId.get(user.id);
            return targetUser ? canReadTrainingProfile(actor, targetUser) : false;
          });
        const usersById = new Map(visibleManagers.map((user) => [user.id, user]));
        const visibleUserIds = new Set(visibleManagers.map((user) => user.id));
        const nowIso = new Date().toISOString();
        visibleManagers.forEach((user) => {
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
          .map((review) => ({ ...review, user: usersById.get(review.userId) || null }));
        const reviews = allVisibleReviews
          .filter((review) => !filterUserId || review.userId === filterUserId)
          .slice(0, reviewLimit);
        const avgScore =
          profiles.length > 0
            ? Math.round(
                profiles.reduce((acc, profile) => acc + (Number(profile.avgScore) || 0), 0) / profiles.length
              )
            : 0;
        const weekAgoMs = Date.now() - 7 * DAY_MS;
        const reviewsThisWeek = allVisibleReviews.filter((review) => {
          const ts = Date.parse(String(review.createdAt || ""));
          return Number.isFinite(ts) && ts >= weekAgoMs;
        }).length;
        const leaderboard = [...profiles]
          .sort((left, right) => {
            if (left.avgScore !== right.avgScore) return right.avgScore - left.avgScore;
            if (left.progressPercent !== right.progressPercent) {
              return right.progressPercent - left.progressPercent;
            }
            return String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""));
          })
          .slice(0, 10);
        return {
          result: json(200, {
            ok: true,
            generatedAt: nowIso,
            actor,
            permissions,
            assignment,
            trainingAssignments,
            users: visibleManagers,
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
          })
        };
      });
    }

    if (pathname.startsWith("/api/admin/training/profiles/") && method === "PATCH") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const userId = normUid(decodePath(pathname.replace("/api/admin/training/profiles/", "")), "");
      if (!userId) return json(400, { error: "USER_ID_REQUIRED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
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
        return json(400, { error: "NO_UPDATABLE_FIELDS" });
      }
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const targetUser = ctx.byId.get(userId);
        if (!targetUser) return { noWrite: true, result: json(404, { error: "USER_NOT_FOUND" }) };
        if (targetUser.role !== ROLE_MANAGER) {
          return { noWrite: true, result: json(400, { error: "TRAINING_TARGET_ROLE_INVALID" }) };
        }
        if (!canManageTrainingProfile(actor, targetUser)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_TRAINING_PROFILE" }) };
        }
        if (!isTrainingAssignedForUser(data, targetUser.id)) {
          return { noWrite: true, result: json(403, { error: "TRAINING_NOT_ASSIGNED" }) };
        }
        const training = ensureTrainingStorage(data);
        const nowIso = new Date().toISOString();
        const profile = ensureTrainingProfileForUser(training, targetUser.id, nowIso);
        if (!profile) return { noWrite: true, result: json(400, { error: "PROFILE_NOT_FOUND" }) };
        let changed = false;
        if (hasPlanStartDate) {
          const nextPlanDate = normIsoDate(body.planStartDate);
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
          const nextStage = normTrainingStage(body.stage);
          if (profile.stage !== nextStage) {
            profile.stage = nextStage;
            changed = true;
          }
        }
        if (hasStatus) {
          const nextStatus = normTrainingStatus(body.status);
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
          const nextNotes = clean(body.notes, 2400);
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
        const usersById = new Map([[targetUser.id, pubUser(targetUser)]]);
        return {
          result: json(200, {
            ok: true,
            changed,
            profile: trainingProfileWithUser(profile, usersById, reviewsByUser)
          })
        };
      });
    }

    if (pathname === "/api/admin/training/reviews" && method === "POST") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const userId = normUid(body.userId, "");
      if (!userId) return json(400, { error: "USER_ID_REQUIRED" });
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const targetUser = ctx.byId.get(userId);
        if (!targetUser) return { noWrite: true, result: json(404, { error: "USER_NOT_FOUND" }) };
        if (targetUser.role !== ROLE_MANAGER) {
          return { noWrite: true, result: json(400, { error: "TRAINING_TARGET_ROLE_INVALID" }) };
        }
        if (!canManageTrainingProfile(actor, targetUser)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_TRAINING_REVIEW" }) };
        }
        if (!isTrainingAssignedForUser(data, targetUser.id)) {
          return { noWrite: true, result: json(403, { error: "TRAINING_NOT_ASSIGNED" }) };
        }
        const training = ensureTrainingStorage(data);
        const nowIso = new Date().toISOString();
        const profile = ensureTrainingProfileForUser(training, targetUser.id, nowIso);
        if (!profile) return { noWrite: true, result: json(400, { error: "PROFILE_NOT_FOUND" }) };
        const review = normTrainingCallReview(
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
        if (!review) return { noWrite: true, result: json(400, { error: "REVIEW_INVALID" }) };
        training.callReviews.push(review);
        if (training.callReviews.length > 6000) {
          training.callReviews = training.callReviews.slice(-6000);
        }
        if (profile.status === "onboarding") profile.status = "active";
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
        const usersById = new Map([[targetUser.id, pubUser(targetUser)]]);
        return {
          result: json(201, {
            ok: true,
            review: {
              ...review,
              user: pubUser(targetUser)
            },
            profile: trainingProfileWithUser(profile, usersById, reviewsByUser)
          })
        };
      });
    }

    if (pathname === "/api/admin/training/assignments" && method === "GET") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const state = await loadState(env);
      const ctx = userCtx(state.users);
      const actor = actorFrom(auth, state.users, ctx);
      if (!actor) return json(401, { error: "UNAUTHORIZED" });
      if (!canManageTrainingAssignments(actor)) {
        return json(403, { error: "FORBIDDEN_TRAINING_ASSIGNMENTS" });
      }
      return json(200, {
        ok: true,
        actor,
        permissions: permsForActor(actor, state.data),
        assignments: getTrainingAssignmentsPayload(actor, state.data, state.users)
      });
    }

    if (pathname.startsWith("/api/admin/training/assignments/") && method === "PATCH") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const userId = normUid(decodePath(pathname.replace("/api/admin/training/assignments/", "")), "");
      if (!userId) return json(400, { error: "USER_ID_REQUIRED" });
      let body;
      try {
        body = await readBodyJson(request);
      } catch (error) {
        return json(400, { error: error.message || "INVALID_REQUEST" });
      }
      const hasAssigned = Object.prototype.hasOwnProperty.call(body, "assigned");
      const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
      if (!hasAssigned && !hasNote) return json(400, { error: "NO_UPDATABLE_FIELDS" });
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        if (!canManageTrainingAssignments(actor)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_TRAINING_ASSIGNMENTS" }) };
        }
        const targetUser = ctx.byId.get(userId);
        if (!targetUser) return { noWrite: true, result: json(404, { error: "USER_NOT_FOUND" }) };
        if (!canManageTrainingAssignmentTarget(actor, targetUser)) {
          return {
            noWrite: true,
            result: json(403, { error: "FORBIDDEN_TRAINING_ASSIGNMENT_TARGET" })
          };
        }
        const performance = ensurePerformanceStorage(data);
        const existing = getTrainingAssignmentEntry(performance, targetUser.id);
        const nowIso = new Date().toISOString();
        const nextAssigned = hasAssigned ? Boolean(body.assigned) : Boolean(existing?.assigned);
        const nextNote = hasNote ? clean(body.note, 1200) : clean(existing?.note, 1200);
        const assignedAt = nextAssigned ? (existing?.assignedAt || nowIso) : "";
        const assignedById = nextAssigned
          ? (existing?.assigned ? existing.assignedById || actor.id : actor.id)
          : "";
        const assignedByName = nextAssigned
          ? (existing?.assigned ? existing.assignedByName || actor.name : actor.name)
          : "";
        const assignment = normTrainingAssignment({
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
          return { noWrite: true, result: json(400, { error: "TRAINING_ASSIGNMENT_UPDATE_FAILED" }) };
        }
        performance.trainingAssignments = [
          ...performance.trainingAssignments.filter((item) => item.userId !== targetUser.id),
          assignment
        ];
        data.performance = performance;
        return {
          result: json(200, {
            ok: true,
            assignment: {
              user: pubUser(targetUser),
              assignment: toPublicTrainingAssignment(assignment)
            }
          })
        };
      });
    }

    if (pathname.startsWith("/api/admin/leads/") && method === "DELETE") {
      const auth = await readAuthPayload(request, env);
      if (!auth) return json(401, { error: "UNAUTHORIZED" });
      const id = decodePath(pathname.replace("/api/admin/leads/", ""));
      if (!id) return json(400, { error: "LEAD_ID_REQUIRED" });
      return mutateState(env, ({ data, users, ctx }) => {
        const actor = actorFrom(auth, users, ctx);
        if (!actor) return { noWrite: true, result: json(401, { error: "UNAUTHORIZED" }) };
        const index = data.leads.findIndex((item) => normLead(item).id === id);
        if (index < 0) return { noWrite: true, result: json(404, { error: "LEAD_NOT_FOUND" }) };
        if (!canAssign(actor)) return { noWrite: true, result: json(403, { error: "FORBIDDEN_DELETE" }) };

        const lead = normLead(data.leads[index]);
        if (!ACTIVE_LEAD_STATUSES.has(lead.status)) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_DELETE_STATUS" }) };
        }

        data.leads.splice(index, 1);
        syncImportantEventsForAllLeads(data);
        return {
          result: json(200, { ok: true, deletedLeadId: lead.id, deletedLeadStatus: lead.status })
        };
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
        const isManager = actor.role === ROLE_MANAGER;
        const isManagerSelfTakeRequest = isManager && hasAssigneeId && nextAssigneeId === actor.id;
        const isManagerOwnLead = isManager && lead.assigneeId === actor.id;

        if (isManager && hasDepartment) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_DEPARTMENT" }) };
        }
        if (isManager && hasAssigneeId && nextAssigneeId && nextAssigneeId !== actor.id) {
          return { noWrite: true, result: json(403, { error: "FORBIDDEN_ASSIGNMENT" }) };
        }
        if (isManagerSelfTakeRequest && lead.assigneeId && lead.assigneeId !== actor.id) {
          return { noWrite: true, result: json(403, { error: "MANAGER_CANNOT_TAKE_ASSIGNED" }) };
        }
        if (isManager && isManagerOwnLead && hasAssigneeId && !nextAssigneeId) {
          return { noWrite: true, result: json(403, { error: "MANAGER_CANNOT_UNASSIGN" }) };
        }

        if (hasStatus) {
          const managerCanTakeAndStart = isManagerSelfTakeRequest && nextStatus === "in_progress";
          if (!canUpdateStatus(actor, lead) && !managerCanTakeAndStart) {
            return { noWrite: true, result: json(403, { error: "FORBIDDEN_STATUS" }) };
          }
          if (isManager && isManagerOwnLead && lead.status === "in_progress" && nextStatus === "new") {
            return { noWrite: true, result: json(403, { error: "MANAGER_CANNOT_RESET" }) };
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
          if (isManager && lead.assigneeId !== actor.id) {
            return { noWrite: true, result: json(403, { error: "FORBIDDEN_NOTE" }) };
          }
          if (lead.internalNote !== nextInternalNote) {
            lead.internalNote = nextInternalNote;
            changed = true;
          }
        }
        if (hasDepartment || hasAssigneeId) {
          const managerSelfTakeOnly = isManagerSelfTakeRequest && !hasDepartment;
          if (!canAssign(actor) && !managerSelfTakeOnly) {
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
              const canAssignThisUser =
                (managerSelfTakeOnly && targetAssigneeId === actor.id) || canAssignTargetUser(actor, assignee);
              if (!canAssignThisUser) {
                return { noWrite: true, result: json(403, { error: "FORBIDDEN_ASSIGNEE" }) };
              }
              targetAssigneeName = assignee.name;
              if (!hasDepartment || assignee.department !== targetDept) targetDept = assignee.department;
            }
          }
          if (!canManageTargetDept(actor, targetDept) && !managerSelfTakeOnly) {
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
        const events = syncImportantEventsForAllLeads(data);
        const leadEventsMap = getLeadEventsMap(events);
        return { result: json(200, { ok: true, lead: attachLeadEvents(lead, leadEventsMap) }) };
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
