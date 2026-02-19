"use strict";

const trainingAuth = document.getElementById("trainingAuth");
const trainingAuthStatus = document.getElementById("trainingAuthStatus");
const trainingPanel = document.getElementById("trainingPanel");
const trainingActorMeta = document.getElementById("trainingActorMeta");
const trainingStatus = document.getElementById("trainingStatus");
const trainingSummary = document.getElementById("trainingSummary");
const refreshTraining = document.getElementById("refreshTraining");

const trainingUserSelect = document.getElementById("trainingUserSelect");
const trainingPlanStartDate = document.getElementById("trainingPlanStartDate");
const trainingCurrentDay = document.getElementById("trainingCurrentDay");
const trainingStage = document.getElementById("trainingStage");
const trainingStatusSelect = document.getElementById("trainingStatusSelect");
const trainingConfidence = document.getElementById("trainingConfidence");
const trainingEnergy = document.getElementById("trainingEnergy");
const trainingControl = document.getElementById("trainingControl");
const trainingNotes = document.getElementById("trainingNotes");
const saveTrainingProfile = document.getElementById("saveTrainingProfile");
const trainingProfileStatus = document.getElementById("trainingProfileStatus");
const trainingProfileMeta = document.getElementById("trainingProfileMeta");

const trainingReviewForm = document.getElementById("trainingReviewForm");
const trainingReviewChannel = document.getElementById("trainingReviewChannel");
const reviewStart = document.getElementById("reviewStart");
const reviewDiagnostics = document.getElementById("reviewDiagnostics");
const reviewPresentation = document.getElementById("reviewPresentation");
const reviewObjections = document.getElementById("reviewObjections");
const reviewClosing = document.getElementById("reviewClosing");
const reviewCrm = document.getElementById("reviewCrm");
const trainingReviewScore = document.getElementById("trainingReviewScore");
const trainingRedFlags = document.getElementById("trainingRedFlags");
const reviewConfidence = document.getElementById("reviewConfidence");
const reviewEnergy = document.getElementById("reviewEnergy");
const reviewControl = document.getElementById("reviewControl");
const reviewComment = document.getElementById("reviewComment");
const trainingReviewStatus = document.getElementById("trainingReviewStatus");

const trainingLeaderboard = document.getElementById("trainingLeaderboard");
const trainingReviews = document.getElementById("trainingReviews");

const apiAllowed = window.location.protocol === "http:" || window.location.protocol === "https:";

const roleLabels = {
  owner: "Владелец",
  help: "Help",
  manager: "Руководитель",
  worker: "Сотрудник"
};

const stageLabels = {
  foundation: "1. Фундамент",
  diagnostics: "2. Диагностика",
  dialog_control: "3. Управление диалогом",
  closing: "4. Закрытие"
};

const statusLabels = {
  onboarding: "Адаптация",
  active: "В обучении",
  certified: "Сертифицирован",
  paused: "Пауза"
};

const channelLabels = {
  call: "Звонок",
  zoom: "Zoom/встреча",
  chat: "Переписка",
  email: "Email"
};

const motivationLabels = {
  base: "Базовый",
  boost: "Усиленный",
  leader: "Лидер"
};

const redFlagOptions = [
  { value: "interrupted_client", label: "Перебивал клиента" },
  { value: "talked_too_much", label: "Говорил более 40% времени" },
  { value: "complex_terms", label: "Использовал сложные термины" },
  { value: "pressure", label: "Давил на клиента" },
  { value: "reading_script", label: "Читал текст" }
];

let actor = null;
let permissions = {};
let users = [];
let profilesByUserId = new Map();
let reviews = [];
let leaderboard = [];
let stats = {
  profilesTotal: 0,
  activeProfiles: 0,
  certifiedProfiles: 0,
  avgScore: 0,
  reviewsTotal: 0,
  reviewsThisWeek: 0
};
let selectedUserId = "";

function resolveApiUrl(path) {
  const helper = window.WELONE_API && typeof window.WELONE_API.url === "function" ? window.WELONE_API.url : null;
  if (helper) {
    return helper(path);
  }

  const rel = String(path || "").trim().replace(/^\/+/, "");
  return new URL(rel, `${window.location.origin}/`).toString();
}

function setText(element, message, color) {
  if (!element) {
    return;
  }

  element.textContent = message;
  if (color) {
    element.style.color = color;
  } else {
    element.style.removeProperty("color");
  }
}

function setAuthState(isRequired) {
  if (trainingAuth) {
    trainingAuth.hidden = !isRequired;
    trainingAuth.setAttribute("aria-hidden", String(!isRequired));
  }
  if (trainingPanel) {
    trainingPanel.hidden = isRequired;
    trainingPanel.setAttribute("aria-hidden", String(isRequired));
  }
}

function setControlsDisabled(disabled) {
  const controls = [
    trainingUserSelect,
    trainingPlanStartDate,
    trainingCurrentDay,
    trainingStage,
    trainingStatusSelect,
    trainingConfidence,
    trainingEnergy,
    trainingControl,
    trainingNotes,
    saveTrainingProfile,
    trainingReviewChannel,
    reviewStart,
    reviewDiagnostics,
    reviewPresentation,
    reviewObjections,
    reviewClosing,
    reviewCrm,
    reviewConfidence,
    reviewEnergy,
    reviewControl,
    reviewComment,
    refreshTraining
  ];

  controls.forEach((control) => {
    if (control) {
      control.disabled = Boolean(disabled);
    }
  });

  if (trainingReviewForm) {
    const submit = trainingReviewForm.querySelector("button[type='submit']");
    if (submit) {
      submit.disabled = Boolean(disabled);
    }
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function formatDate(value, includeTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit"
        }
      : {})
  }).format(date);
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

function normalizeUserId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getCurrentProfile() {
  if (!selectedUserId) {
    return null;
  }

  const profile = profilesByUserId.get(selectedUserId);
  if (profile) {
    return profile;
  }

  return {
    userId: selectedUserId,
    planStartDate: "",
    currentDay: 1,
    stage: "foundation",
    status: "onboarding",
    confidence: 3,
    energy: 3,
    control: 3,
    notes: "",
    progressPercent: 0,
    reviewCount: 0,
    avgScore: 0,
    redFlagsCount: 0,
    motivationLevel: "base"
  };
}

function renderRedFlagInputs() {
  if (!trainingRedFlags) {
    return;
  }

  trainingRedFlags.innerHTML = "";
  redFlagOptions.forEach((option) => {
    const label = document.createElement("label");
    label.className = "training-flags__item";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.value;

    const text = document.createElement("span");
    text.textContent = option.label;

    label.append(input, text);
    trainingRedFlags.appendChild(label);
  });
}

function getReviewDraftTotal() {
  const start = clampInt(reviewStart?.value, 0, 15, 0);
  const diagnostics = clampInt(reviewDiagnostics?.value, 0, 25, 0);
  const presentation = clampInt(reviewPresentation?.value, 0, 20, 0);
  const objections = clampInt(reviewObjections?.value, 0, 15, 0);
  const closing = clampInt(reviewClosing?.value, 0, 15, 0);
  const crm = clampInt(reviewCrm?.value, 0, 10, 0);
  return start + diagnostics + presentation + objections + closing + crm;
}

function renderReviewDraftTotal() {
  if (!trainingReviewScore) {
    return;
  }
  trainingReviewScore.textContent = String(getReviewDraftTotal());
}

function renderActorMeta() {
  if (!trainingActorMeta || !actor) {
    return;
  }

  const role = roleLabels[actor.role] || actor.role || "Сотрудник";
  const name = actor.name || actor.username || actor.id || "Пользователь";
  const policy = permissions.canManageTraining
    ? "может обновлять обучение и разборы"
    : "только просмотр";
  trainingActorMeta.textContent = `${name} • ${role} • ${policy}`;
}

function createSummaryCard(label, value, hint) {
  const card = document.createElement("article");
  card.className = "training-summary__item";

  const valueNode = document.createElement("strong");
  valueNode.className = "training-summary__value";
  valueNode.textContent = value;

  const labelNode = document.createElement("span");
  labelNode.className = "training-summary__label";
  labelNode.textContent = label;

  card.append(valueNode, labelNode);
  if (hint) {
    const hintNode = document.createElement("p");
    hintNode.className = "training-summary__hint";
    hintNode.textContent = hint;
    card.appendChild(hintNode);
  }

  return card;
}

function renderSummary() {
  if (!trainingSummary) {
    return;
  }

  trainingSummary.innerHTML = "";
  trainingSummary.append(
    createSummaryCard("Профили", formatNumber(stats.profilesTotal), "В активной выборке"),
    createSummaryCard("В обучении", formatNumber(stats.activeProfiles), "Статус active"),
    createSummaryCard("Сертифицированы", formatNumber(stats.certifiedProfiles), "Статус certified"),
    createSummaryCard("Средний балл", formatNumber(stats.avgScore), "По чек-листам"),
    createSummaryCard("Разборов за 7 дней", formatNumber(stats.reviewsThisWeek), "Темп контроля")
  );
}

function fillUserSelect() {
  if (!trainingUserSelect) {
    return;
  }

  const prev = selectedUserId;
  trainingUserSelect.innerHTML = "";

  if (!users.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Нет доступных сотрудников";
    trainingUserSelect.appendChild(option);
    selectedUserId = "";
    return;
  }

  users.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = `${user.name || user.username} (${roleLabels[user.role] || user.role || "роль"})`;
    trainingUserSelect.appendChild(option);
  });

  const known = users.some((user) => user.id === prev);
  selectedUserId = known ? prev : users[0].id;
  trainingUserSelect.value = selectedUserId;
}

function renderProfileForm() {
  const profile = getCurrentProfile();
  const hasUser = Boolean(profile && selectedUserId);

  if (trainingPlanStartDate) {
    trainingPlanStartDate.value = hasUser ? String(profile.planStartDate || "") : "";
  }
  if (trainingCurrentDay) {
    trainingCurrentDay.value = hasUser ? String(clampInt(profile.currentDay, 1, 30, 1)) : "1";
  }
  if (trainingStage) {
    trainingStage.value = hasUser ? String(profile.stage || "foundation") : "foundation";
  }
  if (trainingStatusSelect) {
    trainingStatusSelect.value = hasUser ? String(profile.status || "onboarding") : "onboarding";
  }
  if (trainingConfidence) {
    trainingConfidence.value = hasUser ? String(clampInt(profile.confidence, 1, 5, 3)) : "3";
  }
  if (trainingEnergy) {
    trainingEnergy.value = hasUser ? String(clampInt(profile.energy, 1, 5, 3)) : "3";
  }
  if (trainingControl) {
    trainingControl.value = hasUser ? String(clampInt(profile.control, 1, 5, 3)) : "3";
  }
  if (trainingNotes) {
    trainingNotes.value = hasUser ? String(profile.notes || "") : "";
  }

  if (!trainingProfileMeta) {
    return;
  }

  trainingProfileMeta.innerHTML = "";
  if (!hasUser) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Нет сотрудников для обучения.";
    trainingProfileMeta.appendChild(empty);
    return;
  }

  const lines = [
    `Этап: ${stageLabels[profile.stage] || profile.stage || "—"}`,
    `Прогресс: ${formatNumber(profile.progressPercent)}% (день ${formatNumber(profile.currentDay)} из 30)`,
    `Результат разговоров: ${formatNumber(profile.avgScore)} баллов, разборов ${formatNumber(profile.reviewCount)}`,
    `Красные флаги: ${formatNumber(profile.redFlagsCount)} | Мотивация: ${motivationLabels[profile.motivationLevel] || "Базовый"}`,
    profile.lastReviewAt ? `Последний разбор: ${formatDate(profile.lastReviewAt, true)}` : "Последний разбор: нет"
  ];

  lines.forEach((line) => {
    const item = document.createElement("p");
    item.textContent = line;
    trainingProfileMeta.appendChild(item);
  });
}

function renderLeaderboard() {
  if (!trainingLeaderboard) {
    return;
  }

  trainingLeaderboard.innerHTML = "";
  if (!leaderboard.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Данных по рейтингу пока нет.";
    trainingLeaderboard.appendChild(empty);
    return;
  }

  leaderboard.forEach((entry, index) => {
    const row = document.createElement("article");
    row.className = "training-leaderboard__item";

    const title = document.createElement("p");
    title.className = "training-leaderboard__title";
    const userName =
      entry.user?.name || entry.user?.username || users.find((user) => user.id === entry.userId)?.name || entry.userId;
    title.textContent = `${index + 1}. ${userName}`;

    const meta = document.createElement("p");
    meta.className = "training-leaderboard__meta";
    meta.textContent = `Баллы ${formatNumber(entry.avgScore)} • Прогресс ${formatNumber(entry.progressPercent)}% • ${motivationLabels[entry.motivationLevel] || "Базовый"}`;

    row.append(title, meta);
    trainingLeaderboard.appendChild(row);
  });
}

function renderReviews() {
  if (!trainingReviews) {
    return;
  }

  trainingReviews.innerHTML = "";
  const scoped = reviews
    .filter((review) => !selectedUserId || review.userId === selectedUserId)
    .slice(0, 16);

  if (!scoped.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Разборов пока нет.";
    trainingReviews.appendChild(empty);
    return;
  }

  scoped.forEach((review) => {
    const card = document.createElement("article");
    card.className = "training-review-item";

    const head = document.createElement("p");
    head.className = "training-review-item__head";
    const targetName =
      review.user?.name || users.find((user) => user.id === review.userId)?.name || review.userId;
    const channel = channelLabels[review.channel] || review.channel || "Разбор";
    head.textContent = `${targetName} • ${channel} • ${formatDate(review.createdAt, true)}`;

    const score = document.createElement("p");
    score.className = "training-review-item__score";
    score.textContent = `Итог: ${formatNumber(review.totalScore)} / 100`;

    const flags = document.createElement("p");
    flags.className = "training-review-item__flags";
    flags.textContent =
      Array.isArray(review.redFlags) && review.redFlags.length > 0
        ? `Красные флаги: ${review.redFlags.length}`
        : "Красных флагов нет";

    card.append(head, score, flags);
    if (review.comment) {
      const commentNode = document.createElement("p");
      commentNode.className = "training-review-item__comment";
      commentNode.textContent = review.comment;
      card.appendChild(commentNode);
    }

    trainingReviews.appendChild(card);
  });
}

function renderAll() {
  fillUserSelect();
  renderSummary();
  renderActorMeta();
  renderProfileForm();
  renderLeaderboard();
  renderReviews();
}

function collectSelectedRedFlags() {
  if (!trainingRedFlags) {
    return [];
  }
  const checkboxes = Array.from(trainingRedFlags.querySelectorAll("input[type='checkbox']"));
  return checkboxes.filter((item) => item.checked).map((item) => item.value);
}

function setReviewBusy(isBusy) {
  if (!trainingReviewForm) {
    return;
  }
  const submit = trainingReviewForm.querySelector("button[type='submit']");
  if (submit) {
    submit.disabled = isBusy;
  }
}

function resolveTrainingError(error, fallback) {
  if (!error) {
    return fallback;
  }
  if (error.name === "TypeError") {
    return "Backend недоступен. Проверьте WELONE_API_BASE в config.js и CORS.";
  }
  const map = {
    USER_ID_REQUIRED: "Выберите сотрудника.",
    USER_NOT_FOUND: "Сотрудник не найден.",
    FORBIDDEN_TRAINING_PROFILE: "Недостаточно прав для изменения профиля обучения.",
    FORBIDDEN_TRAINING_REVIEW: "Недостаточно прав для сохранения разбора.",
    NO_UPDATABLE_FIELDS: "Нет полей для обновления."
  };
  return map[error.message] || fallback;
}

async function apiRequest(path, options = {}) {
  const { method = "GET", body } = options;
  const response = await fetch(resolveApiUrl(path), {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = {};
    }
  }

  if (!response.ok) {
    const error = new Error(payload.error || `HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function loadTrainingData(options = {}) {
  const { silent = false } = options;
  setControlsDisabled(true);
  if (!silent) {
    setText(trainingStatus, "Загрузка обучения...", "var(--tone-warn)");
  }

  try {
    const payload = await apiRequest("/api/admin/training?limit=180");
    actor = payload.actor || actor;
    permissions = payload.permissions || {};
    users = Array.isArray(payload.users) ? payload.users : [];
    reviews = Array.isArray(payload.reviews) ? payload.reviews : [];
    leaderboard = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
    stats = payload.stats || stats;

    const profiles = Array.isArray(payload.profiles) ? payload.profiles : [];
    profilesByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));

    setAuthState(false);
    renderAll();
    setText(trainingStatus, `Данные обновлены. Разборов: ${formatNumber(stats.reviewsTotal)}.`, "var(--tone-info)");
  } catch (error) {
    setText(trainingStatus, resolveTrainingError(error, "Не удалось загрузить модуль обучения."), "var(--tone-error)");
  } finally {
    setControlsDisabled(false);
  }
}

async function saveProfile() {
  if (!selectedUserId) {
    setText(trainingProfileStatus, "Выберите сотрудника.", "var(--tone-error)");
    return;
  }

  if (!permissions.canManageTraining) {
    setText(trainingProfileStatus, "Недостаточно прав для изменения профиля.", "var(--tone-error)");
    return;
  }

  const payload = {
    planStartDate: String(trainingPlanStartDate?.value || "").trim(),
    currentDay: clampInt(trainingCurrentDay?.value, 1, 30, 1),
    stage: String(trainingStage?.value || "foundation").trim(),
    status: String(trainingStatusSelect?.value || "onboarding").trim(),
    confidence: clampInt(trainingConfidence?.value, 1, 5, 3),
    energy: clampInt(trainingEnergy?.value, 1, 5, 3),
    control: clampInt(trainingControl?.value, 1, 5, 3),
    notes: String(trainingNotes?.value || "").trim()
  };

  setText(trainingProfileStatus, "Сохраняю профиль...", "var(--tone-warn)");
  try {
    const response = await apiRequest(`/api/admin/training/profiles/${encodeURIComponent(selectedUserId)}`, {
      method: "PATCH",
      body: payload
    });

    if (response && response.profile) {
      profilesByUserId.set(response.profile.userId, response.profile);
    }

    renderProfileForm();
    renderLeaderboard();
    setText(trainingProfileStatus, "Профиль обучения сохранен.", "var(--tone-ok)");
    setText(trainingStatus, "Профиль обновлен.", "var(--tone-info)");
  } catch (error) {
    setText(trainingProfileStatus, resolveTrainingError(error, "Не удалось сохранить профиль."), "var(--tone-error)");
  }
}

async function submitReview(event) {
  event.preventDefault();

  if (!selectedUserId) {
    setText(trainingReviewStatus, "Выберите сотрудника.", "var(--tone-error)");
    return;
  }

  if (!permissions.canReviewCalls) {
    setText(trainingReviewStatus, "Недостаточно прав для сохранения разбора.", "var(--tone-error)");
    return;
  }

  const payload = {
    userId: selectedUserId,
    channel: String(trainingReviewChannel?.value || "call").trim(),
    start: clampInt(reviewStart?.value, 0, 15, 0),
    diagnostics: clampInt(reviewDiagnostics?.value, 0, 25, 0),
    presentation: clampInt(reviewPresentation?.value, 0, 20, 0),
    objections: clampInt(reviewObjections?.value, 0, 15, 0),
    closing: clampInt(reviewClosing?.value, 0, 15, 0),
    crm: clampInt(reviewCrm?.value, 0, 10, 0),
    redFlags: collectSelectedRedFlags(),
    confidence: clampInt(reviewConfidence?.value, 1, 5, 3),
    energy: clampInt(reviewEnergy?.value, 1, 5, 3),
    control: clampInt(reviewControl?.value, 1, 5, 3),
    comment: String(reviewComment?.value || "").trim()
  };

  setReviewBusy(true);
  setText(trainingReviewStatus, "Сохраняю разбор...", "var(--tone-warn)");
  try {
    const response = await apiRequest("/api/admin/training/reviews", {
      method: "POST",
      body: payload
    });

    if (response?.profile) {
      profilesByUserId.set(response.profile.userId, response.profile);
    }
    if (response?.review) {
      reviews = [response.review, ...reviews];
    }

    if (reviewComment) {
      reviewComment.value = "";
    }

    await loadTrainingData({ silent: true });
    setText(trainingReviewStatus, "Разбор сохранен.", "var(--tone-ok)");
  } catch (error) {
    setText(trainingReviewStatus, resolveTrainingError(error, "Не удалось сохранить разбор."), "var(--tone-error)");
  } finally {
    setReviewBusy(false);
  }
}

function onUserChange() {
  selectedUserId = normalizeUserId(trainingUserSelect?.value || "");
  renderProfileForm();
  renderReviews();
  setText(trainingProfileStatus, "", "");
  setText(trainingReviewStatus, "", "");
}

if (!apiAllowed) {
  setAuthState(false);
  setText(trainingAuthStatus, "Откройте через сервер: http://localhost:3000/admin-training.html", "var(--tone-error)");
  setText(trainingStatus, "Откройте через сервер: http://localhost:3000/admin-training.html", "var(--tone-error)");
} else {
  setAuthState(false);
  renderRedFlagInputs();
  renderReviewDraftTotal();
  loadTrainingData();

  const scoreInputs = [reviewStart, reviewDiagnostics, reviewPresentation, reviewObjections, reviewClosing, reviewCrm];
  scoreInputs.forEach((input) => {
    if (input) {
      input.addEventListener("input", renderReviewDraftTotal);
    }
  });

  if (trainingUserSelect) {
    trainingUserSelect.addEventListener("change", onUserChange);
  }
  if (saveTrainingProfile) {
    saveTrainingProfile.addEventListener("click", saveProfile);
  }
  if (trainingReviewForm) {
    trainingReviewForm.addEventListener("submit", submitReview);
  }
  if (refreshTraining) {
    refreshTraining.addEventListener("click", () => {
      loadTrainingData();
    });
  }
}
