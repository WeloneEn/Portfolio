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

const trainingBoardsSection = document.getElementById("trainingBoardsSection");
const trainingLeaderboard = document.getElementById("trainingLeaderboard");
const trainingReviews = document.getElementById("trainingReviews");
const trainingProfileSection = document.getElementById("trainingProfileSection");
const trainingReviewSection = document.getElementById("trainingReviewSection");

const trainingWorkflowSection = document.getElementById("trainingWorkflowSection");
const trainingWorkflowStatus = document.getElementById("trainingWorkflowStatus");
const trainingModules = document.getElementById("trainingModules");
const trainingPractice = document.getElementById("trainingPractice");
const trainingDecision = document.getElementById("trainingDecision");
const trainingSurvey = document.getElementById("trainingSurvey");

const apiAllowed = window.location.protocol === "http:" || window.location.protocol === "https:";

const roleLabels = {
  owner: "Владелец",
  product: "Продакт",
  manager: "Менеджер"
};

function resolveRoleLabel(roleValue) {
  const role = String(roleValue || "").trim().toLowerCase();
  if (role === "help" || role === "worker") {
    return roleLabels.manager;
  }
  return roleLabels[role] || roleLabels.manager;
}

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

function applyRoleRestrictions() {
  const canManageTraining = Boolean(permissions.canManageTraining);
  const canReviewCalls = Boolean(permissions.canReviewCalls);
  const flags = getWorkflowRoleFlags();

  const profileControls = [
    trainingPlanStartDate,
    trainingCurrentDay,
    trainingStage,
    trainingStatusSelect,
    trainingConfidence,
    trainingEnergy,
    trainingControl,
    trainingNotes,
    saveTrainingProfile
  ];

  profileControls.forEach((control) => {
    if (control) {
      control.disabled = !canManageTraining;
    }
  });

  if (saveTrainingProfile) {
    saveTrainingProfile.hidden = !canManageTraining;
  }

  const reviewControls = [
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
    reviewComment
  ];

  reviewControls.forEach((control) => {
    if (control) {
      control.disabled = !canReviewCalls;
    }
  });

  if (trainingReviewForm) {
    const submit = trainingReviewForm.querySelector("button[type='submit']");
    if (submit) {
      submit.disabled = !canReviewCalls;
      submit.hidden = !canReviewCalls;
    }
  }

  if (trainingProfileSection) {
    trainingProfileSection.hidden = flags.isManager;
    trainingProfileSection.setAttribute("aria-hidden", String(flags.isManager));
  }
  if (trainingReviewSection) {
    trainingReviewSection.hidden = flags.isManager;
    trainingReviewSection.setAttribute("aria-hidden", String(flags.isManager));
  }

  if (!canManageTraining) {
    setText(
      trainingProfileStatus,
      flags.isManager
        ? "Блок обучения и практика доступны в секции «Пошагово»."
        : "Для вашей роли профиль доступен только для просмотра.",
      "var(--tone-info)"
    );
  }

  if (!canReviewCalls) {
    setText(
      trainingReviewStatus,
      flags.isManager
        ? "Оценку звонков выполняет продакт после отправки вашей CRM-карточки."
        : "Для вашей роли доступен просмотр разборов без редактирования.",
      "var(--tone-info)"
    );
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

function getCurrentWorkflow() {
  const profile = getCurrentProfile();
  const workflow = profile?.workflow && typeof profile.workflow === "object" ? profile.workflow : {};
  const modules = Array.isArray(workflow.modules) ? workflow.modules : [];
  const practice = workflow.practice && typeof workflow.practice === "object" ? workflow.practice : {};
  const contacts = Array.isArray(practice.contacts) ? practice.contacts : [];
  const survey = workflow.survey && typeof workflow.survey === "object" ? workflow.survey : {};

  return {
    modules,
    practice: {
      maxContacts: Math.max(3, Math.min(5, Number(practice.maxContacts) || 3)),
      contacts,
      overallReview: practice.overallReview && typeof practice.overallReview === "object" ? practice.overallReview : {},
      decision: practice.decision && typeof practice.decision === "object" ? practice.decision : { status: "pending" }
    },
    survey
  };
}

function getWorkflowRoleFlags() {
  const role = String(actor?.role || "").toLowerCase();
  return {
    isManager: role === "manager",
    canManageWorkflow: Boolean(permissions.canManageTrainingWorkflow || permissions.canManageTraining),
    canSubmitWorkflow: Boolean(permissions.canSubmitTrainingWorkflow),
    canFinalizeCandidate: Boolean(permissions.canFinalizeTrainingCandidate),
    canSubmitSurvey: Boolean(permissions.canSubmitTrainingSurvey)
  };
}

function setWorkflowStatus(message, color) {
  setText(trainingWorkflowStatus, message, color);
}

function createWorkflowBlock(title) {
  const block = document.createElement("article");
  block.className = "training-workflow__block";
  const head = document.createElement("h3");
  head.textContent = title;
  block.appendChild(head);
  return block;
}

function clampScore10(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  const rounded = Math.round(numeric);
  if (rounded < 0) {
    return 0;
  }
  if (rounded > 10) {
    return 10;
  }
  return rounded;
}

async function patchTrainingWorkflow(action, payload = {}, successMessage = "Изменения сохранены.") {
  if (!selectedUserId) {
    setWorkflowStatus("Выберите сотрудника.", "var(--tone-error)");
    return;
  }

  setWorkflowStatus("Сохраняю изменения...", "var(--tone-warn)");
  try {
    const response = await apiRequest(`/api/admin/training/workflow/${encodeURIComponent(selectedUserId)}`, {
      method: "PATCH",
      body: {
        action,
        ...payload
      }
    });

    if (response?.profile?.userId) {
      profilesByUserId.set(response.profile.userId, response.profile);
    }

    await loadTrainingData({ silent: true });
    setWorkflowStatus(successMessage, "var(--tone-ok)");
  } catch (error) {
    setWorkflowStatus(resolveTrainingError(error, "Не удалось обновить этап обучения."), "var(--tone-error)");
  }
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

  const role = resolveRoleLabel(actor.role);
  const name = actor.name || actor.username || actor.id || "Пользователь";
  const policy = permissions.canManageTraining
    ? "может обновлять обучение и разборы"
    : permissions.canSubmitTrainingWorkflow
      ? "проходит обучение и сдает звонки на проверку продакту"
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
    option.textContent = `${user.name || user.username} (${resolveRoleLabel(user.role)})`;
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
  const profile = getCurrentProfile();
  if (!profile || profile.status !== "certified") {
    if (trainingLeaderboard) {
      trainingLeaderboard.innerHTML = "";
    }
    return;
  }

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
  const profile = getCurrentProfile();
  if (!profile || profile.status !== "certified") {
    if (trainingReviews) {
      trainingReviews.innerHTML = "";
    }
    return;
  }

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

function renderWorkflowModules() {
  if (!trainingModules) {
    return;
  }

  const workflow = getCurrentWorkflow();
  const flags = getWorkflowRoleFlags();
  trainingModules.innerHTML = "";

  if (!workflow.modules.length) {
    const empty = document.createElement("p");
    empty.className = "training-workflow__empty";
    empty.textContent = "Блоки обучения пока не инициализированы.";
    trainingModules.appendChild(empty);
    return;
  }

  workflow.modules.forEach((module, index) => {
    const block = createWorkflowBlock(module.title || `Блок ${index + 1}`);
    const state = module.productApproved
      ? `Статус: + проверено продактом (${module.productReviewedAt ? formatDate(module.productReviewedAt, true) : "дата не указана"})`
      : module.managerCompleted
        ? "Статус: ожидает оценки продакта"
        : "Статус: не завершен менеджером";
    const meta = document.createElement("p");
    meta.className = "training-workflow__meta";
    meta.textContent = state;
    block.appendChild(meta);

    if (flags.canSubmitWorkflow) {
      const noteLabel = document.createElement("label");
      noteLabel.className = "leads-filters__field";
      const noteTitle = document.createElement("span");
      noteTitle.textContent = "Комментарий менеджера по блоку";
      const noteInput = document.createElement("textarea");
      noteInput.rows = 2;
      noteInput.value = String(module.managerNote || "");
      noteLabel.append(noteTitle, noteInput);
      block.appendChild(noteLabel);

      const actions = document.createElement("div");
      actions.className = "training-workflow__actions";
      const submit = document.createElement("button");
      submit.className = "btn btn--primary";
      submit.type = "button";
      submit.textContent = module.managerCompleted ? "Обновить и отправить на оценку" : "Отметить блок как пройденный";
      submit.addEventListener("click", () => {
        patchTrainingWorkflow(
          "manager_complete_module",
          {
            moduleId: module.id,
            note: String(noteInput.value || "").trim()
          },
          "Блок отправлен продакту на оценку."
        );
      });
      actions.appendChild(submit);
      block.appendChild(actions);
    }

    if (flags.canManageWorkflow) {
      const managerMeta = document.createElement("p");
      managerMeta.className = "training-workflow__meta";
      const managerDoneAt = module.managerCompletedAt ? formatDate(module.managerCompletedAt, true) : "не отправлен";
      managerMeta.textContent = `Менеджер: ${managerDoneAt}. Комментарий: ${module.managerNote || "—"}`;
      block.appendChild(managerMeta);

      const scoreGrid = document.createElement("div");
      scoreGrid.className = "training-workflow__grid";
      const buildScoreField = (title, value) => {
        const label = document.createElement("label");
        label.className = "leads-filters__field";
        const span = document.createElement("span");
        span.textContent = `${title} (0-10)`;
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "10";
        input.step = "1";
        input.value = String(clampScore10(value));
        label.append(span, input);
        scoreGrid.appendChild(label);
        return input;
      };
      const knowledge = buildScoreField("Знание", module.productScores?.knowledge);
      const communication = buildScoreField("Коммуникация", module.productScores?.communication);
      const process = buildScoreField("Процесс", module.productScores?.process);
      block.appendChild(scoreGrid);

      const approvedLabel = document.createElement("label");
      approvedLabel.className = "training-workflow__meta";
      const approvedCheck = document.createElement("input");
      approvedCheck.type = "checkbox";
      approvedCheck.checked = Boolean(module.productApproved);
      approvedLabel.append(approvedCheck, document.createTextNode(" Блок принят продактом"));
      block.appendChild(approvedLabel);

      const commentLabel = document.createElement("label");
      commentLabel.className = "leads-filters__field";
      const commentTitle = document.createElement("span");
      commentTitle.textContent = "Комментарий продакта";
      const commentInput = document.createElement("textarea");
      commentInput.rows = 2;
      commentInput.value = String(module.productComment || "");
      commentLabel.append(commentTitle, commentInput);
      block.appendChild(commentLabel);

      const actions = document.createElement("div");
      actions.className = "training-workflow__actions";
      const save = document.createElement("button");
      save.className = "btn btn--ghost";
      save.type = "button";
      save.textContent = "Сохранить оценку блока";
      save.addEventListener("click", () => {
        patchTrainingWorkflow(
          "product_review_module",
          {
            moduleId: module.id,
            knowledge: clampScore10(knowledge.value),
            communication: clampScore10(communication.value),
            process: clampScore10(process.value),
            approved: Boolean(approvedCheck.checked),
            comment: String(commentInput.value || "").trim()
          },
          "Оценка блока сохранена."
        );
      });
      actions.appendChild(save);
      block.appendChild(actions);
    }

    trainingModules.appendChild(block);
  });
}

function renderWorkflowPractice() {
  if (!trainingPractice) {
    return;
  }

  const workflow = getCurrentWorkflow();
  const flags = getWorkflowRoleFlags();
  const modulesApproved = workflow.modules.length > 0 && workflow.modules.every((item) => item.productApproved);
  const contacts = workflow.practice.contacts || [];
  const reviewedCount = contacts.filter((item) => item.callStatus === "reviewed").length;
  const calledCount = contacts.filter((item) => item.callStatus === "called" || item.callStatus === "reviewed").length;

  trainingPractice.innerHTML = "";
  const head = createWorkflowBlock("Практика: контакты и CRM");
  const meta = document.createElement("p");
  meta.className = "training-workflow__meta";
  meta.textContent =
    `Контактов: ${contacts.length}/${workflow.practice.maxContacts} • Прозвонено: ${calledCount} • Проверено продактом: ${reviewedCount}`;
  head.appendChild(meta);

  if (flags.canManageWorkflow) {
    const limitGrid = document.createElement("div");
    limitGrid.className = "training-workflow__grid";
    const limitLabel = document.createElement("label");
    limitLabel.className = "leads-filters__field";
    const limitTitle = document.createElement("span");
    limitTitle.textContent = "Лимит контактов на практике";
    const limitSelect = document.createElement("select");
    ["3", "4", "5"].forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      if (Number(value) === Number(workflow.practice.maxContacts)) {
        option.selected = true;
      }
      limitSelect.appendChild(option);
    });
    limitLabel.append(limitTitle, limitSelect);
    limitGrid.appendChild(limitLabel);

    const saveLimitWrap = document.createElement("div");
    saveLimitWrap.className = "training-workflow__actions";
    const saveLimit = document.createElement("button");
    saveLimit.className = "btn btn--ghost";
    saveLimit.type = "button";
    saveLimit.textContent = "Сохранить лимит";
    saveLimit.addEventListener("click", () => {
      patchTrainingWorkflow(
        "set_practice_limit",
        { maxContacts: Number(limitSelect.value) || 3 },
        "Лимит практики обновлен."
      );
    });
    saveLimitWrap.appendChild(saveLimit);
    limitGrid.appendChild(saveLimitWrap);
    head.appendChild(limitGrid);

    if (modulesApproved && contacts.length < workflow.practice.maxContacts) {
      const addGrid = document.createElement("div");
      addGrid.className = "training-workflow__grid";
      const createInput = (labelText, placeholder) => {
        const label = document.createElement("label");
        label.className = "leads-filters__field";
        const span = document.createElement("span");
        span.textContent = labelText;
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = placeholder;
        label.append(span, input);
        addGrid.appendChild(label);
        return input;
      };
      const nameInput = createInput("Имя клиента", "Иван Петров");
      const contactInput = createInput("Контакт", "+7...");
      const sourceInput = createInput("Источник", "CRM / база / входящий");
      head.appendChild(addGrid);

      const actions = document.createElement("div");
      actions.className = "training-workflow__actions";
      const addButton = document.createElement("button");
      addButton.className = "btn btn--primary";
      addButton.type = "button";
      addButton.textContent = "Добавить контакт";
      addButton.addEventListener("click", () => {
        patchTrainingWorkflow(
          "add_practice_contact",
          {
            name: String(nameInput.value || "").trim(),
            contact: String(contactInput.value || "").trim(),
            source: String(sourceInput.value || "").trim()
          },
          "Контакт добавлен в практику."
        );
      });
      actions.appendChild(addButton);
      head.appendChild(actions);
    } else if (!modulesApproved) {
      const note = document.createElement("p");
      note.className = "training-workflow__empty";
      note.textContent = "Контакты для практики можно назначить после того, как продакт примет все 4 блока обучения.";
      head.appendChild(note);
    }
  }

  trainingPractice.appendChild(head);

  if (!contacts.length) {
    const empty = document.createElement("p");
    empty.className = "training-workflow__empty";
    empty.textContent = "Практические контакты пока не назначены.";
    trainingPractice.appendChild(empty);
    return;
  }

  contacts.forEach((contact, index) => {
    const card = createWorkflowBlock(`Контакт ${index + 1}: ${contact.name || "Без имени"}`);
    const statusLine = document.createElement("p");
    statusLine.className = "training-workflow__meta";
    statusLine.textContent =
      `Контакт: ${contact.contact || "—"} • Статус: ${contact.callStatus || "assigned"} • Источник: ${contact.source || "—"}`;
    card.appendChild(statusLine);

    if (flags.canManageWorkflow && !(contact.managerCall && contact.managerCall.calledAt)) {
      const removeActions = document.createElement("div");
      removeActions.className = "training-workflow__actions";
      const removeButton = document.createElement("button");
      removeButton.className = "btn btn--ghost";
      removeButton.type = "button";
      removeButton.textContent = "Удалить контакт";
      removeButton.addEventListener("click", () => {
        patchTrainingWorkflow(
          "remove_practice_contact",
          { contactId: contact.id },
          "Контакт удален."
        );
      });
      removeActions.appendChild(removeButton);
      card.appendChild(removeActions);
    }

    if (contact.managerCall && contact.managerCall.calledAt) {
      const managerMeta = document.createElement("p");
      managerMeta.className = "training-workflow__meta";
      managerMeta.textContent =
        `Звонок: ${formatDate(contact.managerCall.calledAt, true)} • Результат: ${contact.managerCall.outcome || "—"}`;
      card.appendChild(managerMeta);
      const managerSummary = document.createElement("p");
      managerSummary.className = "training-workflow__meta";
      managerSummary.textContent = `Комментарий менеджера: ${contact.managerCall.summary || "—"}`;
      card.appendChild(managerSummary);
    }

    if (flags.canSubmitWorkflow) {
      const callForm = document.createElement("div");
      callForm.className = "training-workflow__grid";
      const createManagerField = (title, key, placeholder = "") => {
        const label = document.createElement("label");
        label.className = "leads-filters__field";
        const span = document.createElement("span");
        span.textContent = title;
        const input = document.createElement("textarea");
        input.rows = 2;
        input.placeholder = placeholder;
        input.value = String(contact.managerCall?.[key] || contact.managerCall?.crmCard?.[key] || "");
        label.append(span, input);
        callForm.appendChild(label);
        return input;
      };
      const summaryInput = createManagerField("Итог звонка", "summary", "Кратко опишите разговор");
      const outcomeInput = createManagerField("Результат", "outcome", "Договорились / Перезвон / Отказ");
      const companyInput = createManagerField("Компания клиента", "company", "Название компании");
      const needInput = createManagerField("Потребность", "need", "Что важно клиенту");
      const budgetInput = createManagerField("Бюджет", "budget", "Ориентир бюджета");
      const nextStepInput = createManagerField("Следующий шаг", "nextStep", "Дата, формат, задача");
      const notesInput = createManagerField("Заметки CRM", "notes", "Детали для CRM");
      card.appendChild(callForm);

      const actions = document.createElement("div");
      actions.className = "training-workflow__actions";
      const submitCall = document.createElement("button");
      submitCall.className = "btn btn--primary";
      submitCall.type = "button";
      submitCall.textContent = "Сдать звонок и CRM";
      submitCall.addEventListener("click", () => {
        patchTrainingWorkflow(
          "manager_submit_contact_call",
          {
            contactId: contact.id,
            summary: String(summaryInput.value || "").trim(),
            outcome: String(outcomeInput.value || "").trim(),
            company: String(companyInput.value || "").trim(),
            need: String(needInput.value || "").trim(),
            budget: String(budgetInput.value || "").trim(),
            nextStep: String(nextStepInput.value || "").trim(),
            notes: String(notesInput.value || "").trim()
          },
          "Звонок и CRM-карточка отправлены продакту."
        );
      });
      actions.appendChild(submitCall);
      card.appendChild(actions);
    }

    if (flags.canManageWorkflow && contact.managerCall && contact.managerCall.calledAt) {
      const scoreGrid = document.createElement("div");
      scoreGrid.className = "training-workflow__grid training-workflow__grid--score";
      const buildScoreField = (title, key) => {
        const label = document.createElement("label");
        label.className = "leads-filters__field";
        const span = document.createElement("span");
        span.textContent = `${title} (0-10)`;
        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "10";
        input.step = "1";
        input.value = String(clampScore10(contact.productReview?.[key]));
        label.append(span, input);
        scoreGrid.appendChild(label);
        return input;
      };
      const intro = buildScoreField("Старт", "intro");
      const needs = buildScoreField("Диагностика", "needs");
      const offer = buildScoreField("Решение", "offer");
      const objections = buildScoreField("Возражения", "objections");
      const closing = buildScoreField("Закрытие", "closing");
      const crm = buildScoreField("CRM", "crm");
      card.appendChild(scoreGrid);

      const commentLabel = document.createElement("label");
      commentLabel.className = "leads-filters__field";
      const commentTitle = document.createElement("span");
      commentTitle.textContent = "Комментарий продакта по звонку";
      const commentInput = document.createElement("textarea");
      commentInput.rows = 2;
      commentInput.value = String(contact.productReview?.comment || "");
      commentLabel.append(commentTitle, commentInput);
      card.appendChild(commentLabel);

      const actions = document.createElement("div");
      actions.className = "training-workflow__actions";
      const save = document.createElement("button");
      save.className = "btn btn--ghost";
      save.type = "button";
      save.textContent = "Оценить звонок";
      save.addEventListener("click", () => {
        patchTrainingWorkflow(
          "product_review_contact_call",
          {
            contactId: contact.id,
            intro: clampScore10(intro.value),
            needs: clampScore10(needs.value),
            offer: clampScore10(offer.value),
            objections: clampScore10(objections.value),
            closing: clampScore10(closing.value),
            crm: clampScore10(crm.value),
            comment: String(commentInput.value || "").trim()
          },
          "Оценка звонка сохранена."
        );
      });
      actions.appendChild(save);
      card.appendChild(actions);
    }

    if (contact.productReview && contact.productReview.reviewedAt) {
      const reviewMeta = document.createElement("p");
      reviewMeta.className = "training-workflow__meta";
      reviewMeta.textContent =
        `Оценено: ${formatDate(contact.productReview.reviewedAt, true)} • Балл: ${formatNumber(contact.productReview.totalScore)} / 60`;
      card.appendChild(reviewMeta);
    }

    trainingPractice.appendChild(card);
  });
}

function renderWorkflowDecision() {
  if (!trainingDecision) {
    return;
  }

  const workflow = getCurrentWorkflow();
  const flags = getWorkflowRoleFlags();
  const contacts = workflow.practice.contacts || [];
  const reviewedCount = contacts.filter((item) => item.callStatus === "reviewed").length;
  const canFinalize = contacts.length > 0 && reviewedCount === contacts.length;

  trainingDecision.innerHTML = "";
  const block = createWorkflowBlock("Итог по кандидату");
  const decisionStatus = String(workflow.practice.decision?.status || "pending");
  const statusText =
    decisionStatus === "accepted"
      ? "+ кандидат принят"
      : decisionStatus === "rejected"
        ? "- кандидат отклонен"
        : "Ожидает решения продакта";
  const status = document.createElement("p");
  status.className = "training-workflow__meta";
  status.textContent = `Статус: ${statusText}`;
  block.appendChild(status);

  if (flags.canManageWorkflow) {
    const scoreGrid = document.createElement("div");
    scoreGrid.className = "training-workflow__grid training-workflow__grid--score";
    const buildScoreField = (title, key) => {
      const label = document.createElement("label");
      label.className = "leads-filters__field";
      const span = document.createElement("span");
      span.textContent = `${title} (0-10)`;
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.max = "10";
      input.step = "1";
      input.value = String(clampScore10(workflow.practice.overallReview?.[key]));
      label.append(span, input);
      scoreGrid.appendChild(label);
      return input;
    };
    const intro = buildScoreField("Старт", "intro");
    const needs = buildScoreField("Диагностика", "needs");
    const offer = buildScoreField("Решение", "offer");
    const objections = buildScoreField("Возражения", "objections");
    const closing = buildScoreField("Закрытие", "closing");
    const crm = buildScoreField("CRM", "crm");
    block.appendChild(scoreGrid);

    const commentLabel = document.createElement("label");
    commentLabel.className = "leads-filters__field";
    const commentTitle = document.createElement("span");
    commentTitle.textContent = "Общая оценка продакта";
    const commentInput = document.createElement("textarea");
    commentInput.rows = 2;
    commentInput.value = String(workflow.practice.overallReview?.comment || "");
    commentLabel.append(commentTitle, commentInput);
    block.appendChild(commentLabel);

    const reviewActions = document.createElement("div");
    reviewActions.className = "training-workflow__actions";
    const saveReview = document.createElement("button");
    saveReview.className = "btn btn--ghost";
    saveReview.type = "button";
    saveReview.textContent = "Сохранить общую оценку";
    saveReview.addEventListener("click", () => {
      patchTrainingWorkflow(
        "set_overall_review",
        {
          intro: clampScore10(intro.value),
          needs: clampScore10(needs.value),
          offer: clampScore10(offer.value),
          objections: clampScore10(objections.value),
          closing: clampScore10(closing.value),
          crm: clampScore10(crm.value),
          comment: String(commentInput.value || "").trim()
        },
        "Общая оценка сохранена."
      );
    });
    reviewActions.appendChild(saveReview);
    block.appendChild(reviewActions);

    const decisionNoteLabel = document.createElement("label");
    decisionNoteLabel.className = "leads-filters__field";
    const decisionTitle = document.createElement("span");
    decisionTitle.textContent = "Комментарий к решению";
    const decisionInput = document.createElement("textarea");
    decisionInput.rows = 2;
    decisionInput.value = String(workflow.practice.decision?.note || "");
    decisionNoteLabel.append(decisionTitle, decisionInput);
    block.appendChild(decisionNoteLabel);

    const decisionActions = document.createElement("div");
    decisionActions.className = "training-workflow__actions";
    const accept = document.createElement("button");
    accept.className = "btn btn--primary";
    accept.type = "button";
    accept.textContent = "Принять кандидата";
    accept.disabled = !canFinalize || !flags.canFinalizeCandidate;
    accept.addEventListener("click", () => {
      patchTrainingWorkflow(
        "decide_candidate",
        {
          decision: "accepted",
          note: String(decisionInput.value || "").trim()
        },
        "Кандидат принят."
      );
    });
    const reject = document.createElement("button");
    reject.className = "btn btn--ghost";
    reject.type = "button";
    reject.textContent = "Отклонить кандидата";
    reject.disabled = !canFinalize || !flags.canFinalizeCandidate;
    reject.addEventListener("click", () => {
      patchTrainingWorkflow(
        "decide_candidate",
        {
          decision: "rejected",
          note: String(decisionInput.value || "").trim()
        },
        "Кандидат отклонен."
      );
    });
    decisionActions.append(accept, reject);
    block.appendChild(decisionActions);

    const rule = document.createElement("p");
    rule.className = "training-workflow__meta";
    rule.textContent = canFinalize
      ? "Решение доступно: все назначенные контакты оценены."
      : "Для решения нужно, чтобы все назначенные контакты были оценены продактом.";
    block.appendChild(rule);
  } else {
    const info = document.createElement("p");
    info.className = "training-workflow__meta";
    info.textContent = "Итоговое решение принимает продакт.";
    block.appendChild(info);
  }

  trainingDecision.appendChild(block);
}

function renderWorkflowSurvey() {
  if (!trainingSurvey) {
    return;
  }

  const workflow = getCurrentWorkflow();
  const flags = getWorkflowRoleFlags();
  const survey = workflow.survey || {};
  const decisionStatus = String(workflow.practice.decision?.status || "pending");

  trainingSurvey.innerHTML = "";
  const block = createWorkflowBlock("Опрос менеджера после обучения");

  if (flags.canSubmitSurvey) {
    if (decisionStatus === "pending") {
      const wait = document.createElement("p");
      wait.className = "training-workflow__empty";
      wait.textContent = "Опрос откроется после финального решения продакта по результатам практики.";
      block.appendChild(wait);
      trainingSurvey.appendChild(block);
      return;
    }

    const formGrid = document.createElement("div");
    formGrid.className = "training-workflow__grid";
    const mentorScoreLabel = document.createElement("label");
    mentorScoreLabel.className = "leads-filters__field";
    mentorScoreLabel.innerHTML = "<span>Оценка наставника (1-10)</span>";
    const mentorScoreInput = document.createElement("input");
    mentorScoreInput.type = "number";
    mentorScoreInput.min = "1";
    mentorScoreInput.max = "10";
    mentorScoreInput.step = "1";
    mentorScoreInput.value = String(Math.max(1, Math.min(10, Number(survey.mentorScore) || 0)) || "");
    mentorScoreLabel.appendChild(mentorScoreInput);

    const companyScoreLabel = document.createElement("label");
    companyScoreLabel.className = "leads-filters__field";
    companyScoreLabel.innerHTML = "<span>Оценка отношения компании (1-10)</span>";
    const companyScoreInput = document.createElement("input");
    companyScoreInput.type = "number";
    companyScoreInput.min = "1";
    companyScoreInput.max = "10";
    companyScoreInput.step = "1";
    companyScoreInput.value = String(Math.max(1, Math.min(10, Number(survey.companyScore) || 0)) || "");
    companyScoreLabel.appendChild(companyScoreInput);

    formGrid.append(mentorScoreLabel, companyScoreLabel);
    block.appendChild(formGrid);

    const missingLabel = document.createElement("label");
    missingLabel.className = "leads-filters__field";
    missingLabel.innerHTML = "<span>Чего не хватило в обучении</span>";
    const missingInput = document.createElement("textarea");
    missingInput.rows = 2;
    missingInput.value = String(survey.missingTopics || "");
    missingLabel.appendChild(missingInput);
    block.appendChild(missingLabel);

    const mentorFeedbackLabel = document.createElement("label");
    mentorFeedbackLabel.className = "leads-filters__field";
    mentorFeedbackLabel.innerHTML = "<span>Комментарий по наставнику</span>";
    const mentorFeedbackInput = document.createElement("textarea");
    mentorFeedbackInput.rows = 2;
    mentorFeedbackInput.value = String(survey.mentorFeedback || "");
    mentorFeedbackLabel.appendChild(mentorFeedbackInput);
    block.appendChild(mentorFeedbackLabel);

    const companyFeedbackLabel = document.createElement("label");
    companyFeedbackLabel.className = "leads-filters__field";
    companyFeedbackLabel.innerHTML = "<span>Комментарий по компании</span>";
    const companyFeedbackInput = document.createElement("textarea");
    companyFeedbackInput.rows = 2;
    companyFeedbackInput.value = String(survey.companyFeedback || "");
    companyFeedbackLabel.appendChild(companyFeedbackInput);
    block.appendChild(companyFeedbackLabel);

    const actions = document.createElement("div");
    actions.className = "training-workflow__actions";
    const send = document.createElement("button");
    send.className = "btn btn--primary";
    send.type = "button";
    send.textContent = survey.submitted ? "Обновить опрос" : "Отправить опрос";
    send.addEventListener("click", () => {
      patchTrainingWorkflow(
        "manager_submit_survey",
        {
          mentorScore: clampScore10(mentorScoreInput.value),
          companyScore: clampScore10(companyScoreInput.value),
          missingTopics: String(missingInput.value || "").trim(),
          mentorFeedback: String(mentorFeedbackInput.value || "").trim(),
          companyFeedback: String(companyFeedbackInput.value || "").trim()
        },
        "Опрос отправлен."
      );
    });
    actions.appendChild(send);
    block.appendChild(actions);
  } else if (survey.submitted) {
    const info = document.createElement("p");
    info.className = "training-workflow__meta";
    info.textContent =
      `Опрос получен: наставник ${formatNumber(survey.mentorScore)}/10, компания ${formatNumber(survey.companyScore)}/10.`;
    block.appendChild(info);
    if (survey.missingTopics) {
      const missing = document.createElement("p");
      missing.className = "training-workflow__meta";
      missing.textContent = `Чего не хватило: ${survey.missingTopics}`;
      block.appendChild(missing);
    }
  } else {
    const empty = document.createElement("p");
    empty.className = "training-workflow__empty";
    empty.textContent = "Опрос менеджера пока не заполнен.";
    block.appendChild(empty);
  }

  trainingSurvey.appendChild(block);
}

function renderWorkflow() {
  if (!trainingWorkflowSection) {
    return;
  }
  renderWorkflowModules();
  renderWorkflowPractice();
  renderWorkflowDecision();
  renderWorkflowSurvey();
}

function renderAll() {
  fillUserSelect();
  renderSummary();
  renderActorMeta();
  renderProfileForm();
  renderWorkflow();
  const profile = getCurrentProfile();
  const isCertified = Boolean(profile && profile.status === "certified");
  if (trainingBoardsSection) {
    trainingBoardsSection.hidden = !isCertified;
    trainingBoardsSection.setAttribute("aria-hidden", String(!isCertified));
  }
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
  if (!isBusy) {
    applyRoleRestrictions();
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
    FORBIDDEN_TRAINING_WORKFLOW: "Недостаточно прав для действия в обучении.",
    TRAINING_NOT_ASSIGNED: "Обучение еще не назначено продактом.",
    TRAINING_MODULE_NOT_FOUND: "Блок обучения не найден.",
    TRAINING_MODULE_NOT_COMPLETED: "Сначала менеджер должен завершить блок.",
    TRAINING_MODULES_NOT_APPROVED: "Продакт должен принять все блоки перед практикой.",
    TRAINING_PRACTICE_LIMIT_TOO_LOW: "Нельзя установить лимит меньше уже назначенных контактов.",
    TRAINING_CONTACT_NAME_CONTACT_REQUIRED: "Для контакта нужны имя и контакт.",
    TRAINING_PRACTICE_LIMIT_REACHED: "Достигнут лимит контактов на практику.",
    TRAINING_CONTACT_NOT_FOUND: "Практический контакт не найден.",
    TRAINING_CONTACT_ALREADY_IN_PROGRESS: "Контакт уже в работе, удалить нельзя.",
    TRAINING_CALL_SUMMARY_REQUIRED: "Опишите итог звонка перед отправкой.",
    TRAINING_CONTACT_CALL_NOT_SUBMITTED: "Менеджер еще не отправил результат звонка.",
    TRAINING_NO_REVIEWED_CONTACTS: "Сначала оцените хотя бы один звонок.",
    TRAINING_DECISION_INVALID: "Выберите корректное решение: принять или отклонить.",
    TRAINING_NO_PRACTICE_CONTACTS: "Нельзя вынести решение без назначенных контактов.",
    TRAINING_CONTACTS_NOT_REVIEWED: "Все назначенные контакты должны быть оценены продактом.",
    TRAINING_SURVEY_NOT_AVAILABLE: "Опрос доступен только после финального решения по кандидату.",
    TRAINING_SURVEY_SCORES_REQUIRED: "Поставьте оценки наставнику и компании.",
    TRAINING_WORKFLOW_ACTION_UNKNOWN: "Неизвестное действие в workflow обучения.",
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
    setWorkflowStatus("Пошаговый режим обучения обновлен.", "var(--tone-info)");
  } catch (error) {
    setText(trainingStatus, resolveTrainingError(error, "Не удалось загрузить модуль обучения."), "var(--tone-error)");
    setWorkflowStatus(resolveTrainingError(error, "Не удалось загрузить пошаговое обучение."), "var(--tone-error)");
  } finally {
    setControlsDisabled(false);
    applyRoleRestrictions();
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
  renderWorkflow();
  renderReviews();
  setText(trainingProfileStatus, "", "");
  setText(trainingReviewStatus, "", "");
  setWorkflowStatus("", "");
  applyRoleRestrictions();
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
