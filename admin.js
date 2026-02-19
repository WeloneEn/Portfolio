"use strict";


const adminAuth = document.getElementById("adminAuth");
const adminPanel = document.getElementById("adminPanel");
const adminStatus = document.getElementById("adminStatus");
const adminUserMeta = document.getElementById("adminUserMeta");
const adminStatsHint = document.getElementById("adminStatsHint");
const refreshAdmin = document.getElementById("refreshAdmin");
const trainingNavLinks = Array.from(document.querySelectorAll('a[href="admin-training.html"]'));
const roleBoundSubnavLinks = Array.from(document.querySelectorAll("[data-subnav-link]"));
const roleBoundActionLinks = Array.from(document.querySelectorAll("[data-action-link]"));
const trafficFolder = document.getElementById("trafficFolder");
const leadsFolder = document.getElementById("leadsFolder");
const conversionFolder = document.getElementById("conversionFolder");

const ownerPlanPanel = document.getElementById("ownerPlanPanel");
const ownerPlanStatus = document.getElementById("ownerPlanStatus");
const ownerPlanGrid = document.getElementById("ownerPlanGrid");
const ownerPlanForm = document.getElementById("ownerPlanForm");
const ownerPlanDay = document.getElementById("ownerPlanDay");
const ownerPlanWeek = document.getElementById("ownerPlanWeek");
const ownerPlanMonth = document.getElementById("ownerPlanMonth");

const ownerLeaderboardPanel = document.getElementById("ownerLeaderboardPanel");
const ownerLeaderboardStatus = document.getElementById("ownerLeaderboardStatus");
const ownerLeaderboardList = document.getElementById("ownerLeaderboardList");

const productPanel = document.getElementById("productPanel");
const productPanelStatus = document.getElementById("productPanelStatus");
const productTeamFolder = document.getElementById("productTeamFolder");
const productLeaderboardFolder = document.getElementById("productLeaderboardFolder");
const productTopStats = document.getElementById("productTopStats");
const productManagerStats = document.getElementById("productManagerStats");
const productLeaderboard = document.getElementById("productLeaderboard");

const managerPanel = document.getElementById("managerPanel");
const managerPanelStatus = document.getElementById("managerPanelStatus");
const managerStatsGrid = document.getElementById("managerStatsGrid");
const managerLeaderboardSnippet = document.getElementById("managerLeaderboardSnippet");

const trainingAssignSection = document.getElementById("trainingAssignSection");
const trainingAssignStatus = document.getElementById("trainingAssignStatus");
const trainingAssignList = document.getElementById("trainingAssignList");

const adminTeamSection = document.getElementById("adminTeamSection");
const adminUserCreateForm = document.getElementById("adminUserCreateForm");
const adminCreateUsername = document.getElementById("adminCreateUsername");
const adminCreatePassword = document.getElementById("adminCreatePassword");
const adminCreateRole = document.getElementById("adminCreateRole");
const adminUserStatus = document.getElementById("adminUserStatus");
const adminUserList = document.getElementById("adminUserList");

const apiAllowed = window.location.protocol === "http:" || window.location.protocol === "https:";

const roleLabels = {
  owner: "Владелец",
  product: "Продакт",
  manager: "Менеджер"
};

let actor = null;
let permissions = {};
let statsPayload = null;
let teamPayload = null;
let adminUsers = [];
let busy = false;

function resolveRoleLabel(roleValue) {
  const role = String(roleValue || "").trim().toLowerCase();
  if (role === "help" || role === "worker") {
    return roleLabels.manager;
  }
  return roleLabels[role] || roleLabels.manager;
}

function resolveApiUrl(path) {
  const helper = window.WELONE_API && typeof window.WELONE_API.url === "function" ? window.WELONE_API.url : null;
  if (helper) {
    return helper(path);
  }
  const rel = String(path || "").trim().replace(/^\/+/, "");
  return new URL(rel, `${window.location.origin}/`).toString();
}

function setText(node, text, color) {
  if (!node) {
    return;
  }
  node.textContent = text;
  if (color) {
    node.style.color = color;
  } else {
    node.style.removeProperty("color");
  }
}

function setBusy(nextBusy) {
  busy = Boolean(nextBusy);
  if (refreshAdmin) {
    refreshAdmin.disabled = busy;
  }
}

function setRolePanelVisible(node, visible) {
  if (!node) {
    return;
  }
  node.hidden = !visible;
  node.setAttribute("aria-hidden", String(!visible));
}

function setStatsHint(message) {
  if (!adminStatsHint) {
    return;
  }
  const text = String(message || "").trim();
  adminStatsHint.hidden = !text;
  adminStatsHint.setAttribute("aria-hidden", String(!text));
  adminStatsHint.textContent = text;
}

function setTrainingNavVisible(isVisible) {
  trainingNavLinks.forEach((link) => {
    link.classList.toggle("is-hidden-link", !isVisible);
    link.setAttribute("aria-hidden", String(!isVisible));
    link.tabIndex = isVisible ? 0 : -1;
  });
}

function parseAccessRoles(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function setRoleBoundLinksVisibility(links, role) {
  links.forEach((link) => {
    const allowedRoles = parseAccessRoles(link?.dataset?.roles);
    const isVisible = !allowedRoles.length || allowedRoles.includes(String(role || "").toLowerCase());
    link.hidden = !isVisible;
    link.classList.toggle("is-hidden-link", !isVisible);
    link.setAttribute("aria-hidden", String(!isVisible));
    link.tabIndex = isVisible ? 0 : -1;
  });
}

function syncRoleBoundNavigation(role) {
  setRoleBoundLinksVisibility(roleBoundSubnavLinks, role);
  setRoleBoundLinksVisibility(roleBoundActionLinks, role);

  const trainingAllowed = permissions.canAccessTraining !== false;
  [...roleBoundSubnavLinks, ...roleBoundActionLinks].forEach((link) => {
    const href = String(link?.getAttribute?.("href") || "").toLowerCase();
    if (!href.endsWith("admin-training.html")) {
      return;
    }
    if (trainingAllowed) {
      return;
    }
    link.hidden = true;
    link.classList.add("is-hidden-link");
    link.setAttribute("aria-hidden", "true");
    link.tabIndex = -1;
  });
}

function setDetailsOpen(node, shouldOpen) {
  if (!(node instanceof HTMLDetailsElement)) {
    return;
  }
  node.open = Boolean(shouldOpen);
}

function applyRoleDensity(role) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (normalizedRole === "owner") {
    setDetailsOpen(trafficFolder, true);
    setDetailsOpen(leadsFolder, false);
    setDetailsOpen(conversionFolder, false);
    setDetailsOpen(productTeamFolder, false);
    setDetailsOpen(productLeaderboardFolder, false);
    setDetailsOpen(trainingAssignSection, false);
    return;
  }

  if (normalizedRole === "product") {
    setDetailsOpen(trafficFolder, false);
    setDetailsOpen(leadsFolder, true);
    setDetailsOpen(conversionFolder, true);
    setDetailsOpen(productPanel, true);
    setDetailsOpen(productTeamFolder, true);
    setDetailsOpen(productLeaderboardFolder, false);
    setDetailsOpen(trainingAssignSection, false);
    return;
  }

  if (normalizedRole === "manager") {
    setDetailsOpen(trafficFolder, false);
    setDetailsOpen(leadsFolder, true);
    setDetailsOpen(conversionFolder, false);
    setDetailsOpen(productTeamFolder, false);
    setDetailsOpen(productLeaderboardFolder, false);
    setDetailsOpen(trainingAssignSection, false);
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function formatPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0%";
  }
  return `${Math.round(numeric * 10) / 10}%`;
}

function prettifyDepartment(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "unassigned") {
    return "Без отдела";
  }
  return raw
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function setStatValue(statKey, value) {
  const element = document.querySelector(`[data-stat="${statKey}"]`);
  if (element) {
    element.textContent = value;
  }
}

function parsePlanBucket(period) {
  const target = Math.max(0, Math.floor(Number(period?.target) || 0));
  const achieved = Math.max(0, Math.floor(Number(period?.achieved) || 0));
  const remaining = Math.max(0, Math.floor(Number(period?.remaining) || 0));
  const completionPercent = Number(period?.completionPercent);
  return {
    target,
    achieved,
    remaining,
    completionPercent: Number.isFinite(completionPercent) ? completionPercent : 0
  };
}

function createKpiCard(label, value, hint) {
  const card = document.createElement("article");
  card.className = "lead-summary";

  const valueNode = document.createElement("strong");
  valueNode.className = "lead-summary__value";
  valueNode.textContent = value;

  const labelNode = document.createElement("span");
  labelNode.className = "lead-summary__label";
  labelNode.textContent = label;

  card.append(valueNode, labelNode);
  if (hint) {
    const hintNode = document.createElement("small");
    hintNode.className = "lead-summary__hint";
    hintNode.textContent = hint;
    card.appendChild(hintNode);
  }

  return card;
}

function createSimpleRow(titleText, metaText) {
  const row = document.createElement("article");
  row.className = "admin-team__item";

  const meta = document.createElement("div");
  meta.className = "admin-team__meta";

  const title = document.createElement("strong");
  title.textContent = titleText;

  const subtitle = document.createElement("span");
  subtitle.textContent = metaText;

  meta.append(title, subtitle);
  row.appendChild(meta);
  return row;
}

async function apiRequest(path, options = {}) {
  const { method = "GET", body } = options;
  const headers = body !== undefined ? { "Content-Type": "application/json" } : {};

  const response = await fetch(resolveApiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
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

function renderActorMeta() {
  if (!adminUserMeta || !actor) {
    return;
  }
  const name = actor.name || actor.username || actor.id || "Пользователь";
  const role = resolveRoleLabel(actor.role);
  adminUserMeta.textContent = `${name} • ${role} • ${prettifyDepartment(actor.department)}`;
}

function renderGeneralStats(stats) {
  const periods = stats?.periods || {};
  const day = periods.day || {};
  const week = periods.week || {};
  const month = periods.month || {};

  setStatValue("todayUniqueVisitors", formatNumber(stats.todayUniqueVisitors));
  setStatValue("uniqueVisitors7d", formatNumber(stats.uniqueVisitors7d));
  setStatValue("uniqueVisitors30d", formatNumber(stats.uniqueVisitors30d));
  setStatValue("secretHuntersPercent", formatPercent(stats.secretHuntersPercent));
  setStatValue("leadsDay", formatNumber(day.created));
  setStatValue("leadsWeek", formatNumber(week.created));
  setStatValue("leadsMonth", formatNumber(month.created));
  setStatValue("dealsDay", formatNumber(day.processed));
  setStatValue("dealsWeek", formatNumber(week.processed));
  setStatValue("dealsMonth", formatNumber(month.processed));
  setStatValue("leadsProcessed", formatNumber(stats.leadsProcessed));
  setStatValue("leadsSuccess", formatNumber(stats.leadsSuccess));
  setStatValue("leadsFailure", formatNumber(stats.leadsFailure));
  setStatValue("leadSuccessRatePercent", formatPercent(stats.leadSuccessRatePercent));
}

function getTrainingGate(stats) {
  const training = stats?.training || {};
  const certifiedManagers = Math.max(0, Number(training.certifiedManagers) || 0);
  const actorCertified = Boolean(training.actorCertified);
  const certifiedManagerIds = new Set(
    Array.isArray(training.certifiedManagerIds) ? training.certifiedManagerIds.map((item) => String(item || "")) : []
  );
  return {
    certifiedManagers,
    actorCertified,
    certifiedManagerIds
  };
}

function renderProductPanel(stats) {
  if (!productPanel || !productTopStats || !productManagerStats || !productLeaderboard) {
    return;
  }

  const perf = stats?.managerPerformance || {};
  const managersRaw = Array.isArray(perf.managers)
    ? perf.managers
    : Array.isArray(perf.rows)
      ? perf.rows
      : [];
  const leaderboardRaw = Array.isArray(perf.leaderboard) ? perf.leaderboard : [];
  const gate = getTrainingGate(stats);
  const managers = managersRaw.filter((row) => gate.certifiedManagerIds.has(String(row?.userId || "")));
  const leaderboard = leaderboardRaw.filter((row) => gate.certifiedManagerIds.has(String(row?.userId || "")));

  productTopStats.innerHTML = "";
  productTopStats.append(
    createKpiCard("Сертифицировано", formatNumber(gate.certifiedManagers), "Менеджеры после обучения"),
    createKpiCard("Сделки за месяц", formatNumber(managers.reduce((acc, row) => acc + (Number(row.periods?.month?.success) || 0), 0)), "Только сертифицированные"),
    createKpiCard("Выполнение плана", formatPercent(managers.length ? managers.reduce((acc, row) => acc + (Number(row.periods?.month?.planCompletionPercent) || 0), 0) / managers.length : 0), "Среднее по команде")
  );

  productManagerStats.innerHTML = "";
  if (!managers.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Панель появится после завершения обучения хотя бы одним менеджером.";
    productManagerStats.appendChild(empty);
  } else {
    managers.forEach((row) => {
      const userName = row.user?.name || row.user?.username || row.userId;
      const meta =
        `День ${formatNumber(row.periods?.day?.success)}/${formatNumber(row.periods?.day?.planTarget)} • ` +
        `Неделя ${formatNumber(row.periods?.week?.success)}/${formatNumber(row.periods?.week?.planTarget)} • ` +
        `Месяц ${formatNumber(row.periods?.month?.success)}/${formatNumber(row.periods?.month?.planTarget)}`;
      productManagerStats.appendChild(createSimpleRow(userName, meta));
    });
  }

  productLeaderboard.innerHTML = "";
  if (!leaderboard.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Рейтинг появится после сертификации менеджеров.";
    productLeaderboard.appendChild(empty);
  } else {
    leaderboard.slice(0, 10).forEach((entry) => {
      const userName = entry.user?.name || entry.user?.username || entry.userId;
      const meta = `Сделки ${formatNumber(entry.periods?.month?.success)} • Выполнение ${formatPercent(entry.periods?.month?.planCompletionPercent)}`;
      productLeaderboard.appendChild(createSimpleRow(`#${entry.rank} ${userName}`, meta));
    });
  }

  setText(productPanelStatus, "Подробная статистика показывается только для менеджеров, завершивших обучение.", "var(--tone-info)");
}

function renderOwnerPlanPanel(stats) {
  if (!ownerPlanPanel || !ownerPlanGrid) {
    return;
  }

  const plans = stats?.plans || {};
  const day = parsePlanBucket(plans.day);
  const week = parsePlanBucket(plans.week);
  const month = parsePlanBucket(plans.month);
  const hiring = stats?.trainingHiring || {};
  const acceptedCount = Math.max(0, Number(hiring.acceptedCount) || 0);
  const rejectedCount = Math.max(0, Number(hiring.rejectedCount) || 0);
  const pendingCount = Math.max(0, Number(hiring.pendingCount) || 0);
  const surveysSubmitted = Math.max(0, Number(hiring.surveysSubmitted) || 0);
  const mentorAvgScore = Number(hiring.mentorAvgScore) || 0;
  const companyAvgScore = Number(hiring.companyAvgScore) || 0;
  const missingTopics = Array.isArray(hiring.missingTopics) ? hiring.missingTopics : [];

  ownerPlanGrid.innerHTML = "";
  ownerPlanGrid.append(
    createKpiCard(
      "День",
      `${formatNumber(day.achieved)} / ${formatNumber(day.target)}`,
      `Выполнение: ${formatPercent(day.completionPercent)} • Осталось: ${formatNumber(day.remaining)}`
    ),
    createKpiCard(
      "Неделя",
      `${formatNumber(week.achieved)} / ${formatNumber(week.target)}`,
      `Выполнение: ${formatPercent(week.completionPercent)} • Осталось: ${formatNumber(week.remaining)}`
    ),
    createKpiCard(
      "Месяц",
      `${formatNumber(month.achieved)} / ${formatNumber(month.target)}`,
      `Выполнение: ${formatPercent(month.completionPercent)} • Осталось: ${formatNumber(month.remaining)}`
    ),
    createKpiCard(
      "Кандидаты",
      `+ ${formatNumber(acceptedCount)} / - ${formatNumber(rejectedCount)}`,
      `В ожидании: ${formatNumber(pendingCount)}`
    ),
    createKpiCard(
      "Опросы менеджеров",
      `${formatNumber(surveysSubmitted)}`,
      `Наставник: ${Math.round(mentorAvgScore * 10) / 10}/10 • Компания: ${Math.round(companyAvgScore * 10) / 10}/10`
    )
  );

  if (ownerPlanDay) {
    ownerPlanDay.value = String(day.target);
  }
  if (ownerPlanWeek) {
    ownerPlanWeek.value = String(week.target);
  }
  if (ownerPlanMonth) {
    ownerPlanMonth.value = String(month.target);
  }

  const missingTopicsText = missingTopics.length
    ? `Недостатки по опросам: ${missingTopics
        .map((item) => `${item.topic} (${formatNumber(item.count)})`)
        .join(", ")}.`
    : "Опросы: критичных повторяющихся замечаний пока нет.";
  setText(
    ownerPlanStatus,
    `Заключено сделок: день ${formatNumber(day.achieved)} • неделя ${formatNumber(week.achieved)} • месяц ${formatNumber(month.achieved)}. ${missingTopicsText}`,
    "var(--tone-info)"
  );
}

function renderOwnerLeaderboard(stats) {
  if (!ownerLeaderboardPanel || !ownerLeaderboardList) {
    return;
  }

  const perf = stats?.managerPerformance || {};
  const leaderboard = Array.isArray(perf.leaderboard) ? perf.leaderboard : [];

  ownerLeaderboardList.innerHTML = "";
  if (!leaderboard.length) {
    setText(ownerLeaderboardStatus, "Рейтинг появится после первых закрытых сделок.", "var(--tone-info)");
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Пока нет данных для leaderboard.";
    ownerLeaderboardList.appendChild(empty);
    return;
  }

  setText(ownerLeaderboardStatus, "Рейтинг за месяц: очки, закрытые сделки и выполнение плана.", "var(--tone-info)");
  leaderboard.slice(0, 12).forEach((entry) => {
    const userName = entry.user?.name || entry.user?.username || entry.userId;
    const points = Number(entry.periods?.month?.points) || 0;
    const success = Number(entry.periods?.month?.success) || 0;
    const completion = Number(entry.periods?.month?.planCompletionPercent) || 0;
    ownerLeaderboardList.appendChild(
      createSimpleRow(
        `#${entry.rank} ${userName}`,
        `Очки ${formatNumber(points)} • Сделки ${formatNumber(success)} • Выполнение ${formatPercent(completion)}`
      )
    );
  });
}

function renderManagerPanel(stats) {
  if (!managerPanel || !managerStatsGrid || !managerLeaderboardSnippet) {
    return;
  }

  const perf = stats?.managerPerformance || {};
  const self = perf.self || null;
  const leaderboard = Array.isArray(perf.leaderboard) ? perf.leaderboard : [];

  managerStatsGrid.innerHTML = "";
  if (!self) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Личная статистика недоступна.";
    managerStatsGrid.appendChild(empty);
  } else {
    managerStatsGrid.append(
      createKpiCard("День", `${formatNumber(self.periods?.day?.success)} / ${formatNumber(self.periods?.day?.planTarget)}`, `Выполнение: ${formatPercent(self.periods?.day?.planCompletionPercent)}`),
      createKpiCard("Неделя", `${formatNumber(self.periods?.week?.success)} / ${formatNumber(self.periods?.week?.planTarget)}`, `Выполнение: ${formatPercent(self.periods?.week?.planCompletionPercent)}`),
      createKpiCard("Месяц", `${formatNumber(self.periods?.month?.success)} / ${formatNumber(self.periods?.month?.planTarget)}`, `Выполнение: ${formatPercent(self.periods?.month?.planCompletionPercent)}`)
    );
  }

  managerLeaderboardSnippet.innerHTML = "";
  if (leaderboard.length) {
    leaderboard.slice(0, 5).forEach((entry) => {
      const userName = entry.user?.name || entry.user?.username || entry.userId;
      managerLeaderboardSnippet.appendChild(
        createSimpleRow(`#${entry.rank} ${userName}`, `Сделки ${formatNumber(entry.periods?.month?.success)} • Выполнение ${formatPercent(entry.periods?.month?.planCompletionPercent)}`)
      );
    });
  }

  const trainingHint = stats?.training?.canAccess
    ? "Обучение назначено продактом. Данные по обучению ведет продакт."
    : "Обучение не назначено продактом.";
  setText(managerPanelStatus, trainingHint, "var(--tone-info)");
}

function setAdminUserStatus(message, color) {
  setText(adminUserStatus, message, color);
}

function renderTrainingAssignments() {
  if (!trainingAssignList) {
    return;
  }

  const items = Array.isArray(teamPayload?.trainingAssignments) ? teamPayload.trainingAssignments : [];
  trainingAssignList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Нет менеджеров для назначения обучения.";
    trainingAssignList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const user = item.user || {};
    const assignment = item.assignment || {};

    const row = document.createElement("article");
    row.className = "admin-team__item";

    const meta = document.createElement("div");
    meta.className = "admin-team__meta";

    const title = document.createElement("strong");
    title.textContent = `${user.name || user.username || user.id}`;
    const subtitle = document.createElement("span");
    subtitle.textContent = `${prettifyDepartment(user.department)} • ${assignment.assigned ? "назначено" : "не назначено"}`;
    meta.append(title, subtitle);

    const actions = document.createElement("div");
    actions.className = "admin-team__actions";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(assignment.assigned);

    const note = document.createElement("input");
    note.type = "text";
    note.placeholder = "Комментарий";
    note.value = String(assignment.note || "");

    const save = document.createElement("button");
    save.className = "btn btn--ghost";
    save.type = "button";
    save.textContent = "Сохранить";

    save.addEventListener("click", async () => {
      checkbox.disabled = true;
      note.disabled = true;
      save.disabled = true;
      setText(trainingAssignStatus, "Сохраняю назначение...", "var(--tone-warn)");
      try {
        await apiRequest(`/api/admin/training/assignments/${encodeURIComponent(user.id)}`, {
          method: "PATCH",
          body: {
            assigned: Boolean(checkbox.checked),
            note: String(note.value || "").trim()
          }
        });
        await loadDashboard({ silent: true });
        setText(trainingAssignStatus, "Назначение обновлено.", "var(--tone-ok)");
      } catch {
        setText(trainingAssignStatus, "Не удалось обновить назначение обучения.", "var(--tone-error)");
      } finally {
        checkbox.disabled = false;
        note.disabled = false;
        save.disabled = false;
      }
    });

    actions.append(checkbox, note, save);
    row.append(meta, actions);
    trainingAssignList.appendChild(row);
  });
}

function renderAdminUsers() {
  if (!adminUserList) {
    return;
  }

  const users = adminUsers.filter((user) => user.role !== "owner");
  adminUserList.innerHTML = "";

  if (!users.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Пользователей для управления нет.";
    adminUserList.appendChild(empty);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement("article");
    row.className = "admin-team__item";

    const meta = document.createElement("div");
    meta.className = "admin-team__meta";
    const title = document.createElement("strong");
    title.textContent = `${user.name || user.username} (@${user.username})`;
    const subtitle = document.createElement("span");
    subtitle.textContent = `${resolveRoleLabel(user.role)} • ${prettifyDepartment(user.department)}`;
    meta.append(title, subtitle);

    const actions = document.createElement("div");
    actions.className = "admin-team__actions";

    const remove = document.createElement("button");
    remove.className = "btn btn--ghost";
    remove.type = "button";
    remove.textContent = "Удалить";

    remove.addEventListener("click", async () => {
      const confirmDelete = window.confirm(`Удалить ${user.username}?`);
      if (!confirmDelete) {
        return;
      }
      setAdminUserStatus("Удаляю пользователя...", "var(--tone-warn)");
      try {
        await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
        await loadAdminUsers();
        setAdminUserStatus("Пользователь удален.", "var(--tone-ok)");
      } catch {
        setAdminUserStatus("Не удалось удалить пользователя.", "var(--tone-error)");
      }
    });

    actions.appendChild(remove);
    row.append(meta, actions);
    adminUserList.appendChild(row);
  });
}

async function loadAdminUsers() {
  if (actor?.role !== "owner") {
    setRolePanelVisible(adminTeamSection, false);
    return;
  }

  setRolePanelVisible(adminTeamSection, true);
  const payload = await apiRequest("/api/admin/users");
  adminUsers = Array.isArray(payload.users) ? payload.users : [];
  renderAdminUsers();
}

function renderRolePanels(stats) {
  const role = actor?.role || "";
  const gate = getTrainingGate(stats);
  const showOwnerPlan = role === "owner";
  const showOwnerLeaderboard = role === "owner";
  const showProductPanel = role === "product";
  const showManagerPanel = role === "manager" && gate.actorCertified;
  const showTrainingAssign = role === "product" && Boolean(permissions.canManageTrainingAssignments);

  syncRoleBoundNavigation(role);
  applyRoleDensity(role);
  setRolePanelVisible(ownerPlanPanel, showOwnerPlan);
  setRolePanelVisible(ownerLeaderboardPanel, showOwnerLeaderboard);
  setRolePanelVisible(productPanel, showProductPanel);
  setRolePanelVisible(managerPanel, showManagerPanel);
  setRolePanelVisible(trainingAssignSection, showTrainingAssign);

  if (showOwnerPlan) {
    renderOwnerPlanPanel(stats);
  }
  if (showOwnerLeaderboard) {
    renderOwnerLeaderboard(stats);
  }
  if (showProductPanel) {
    renderProductPanel(stats);
  }
  if (showManagerPanel) {
    renderManagerPanel(stats);
  }
  if (showTrainingAssign) {
    renderTrainingAssignments();
  }

  if (role === "owner") {
    setStatsHint("Режим владельца: статистика, план по сделкам, leaderboard, сотрудники и доступ к важным событиям.");
    return;
  }
  if (role === "product") {
    setStatsHint("Режим продакта: управление заявками, событиями, обучением и контролем менеджеров в компактных секциях.");
    return;
  }
  if (role === "manager" && !showManagerPanel) {
    setStatsHint("Личная панель менеджера появится после завершения обучения.");
    return;
  }
  setStatsHint("");
}

async function createUser(event) {
  event.preventDefault();
  if (actor?.role !== "owner") {
    return;
  }

  const username = String(adminCreateUsername?.value || "").trim();
  const password = String(adminCreatePassword?.value || "").trim();
  const role = String(adminCreateRole?.value || "manager").trim();
  const name = username;
  const department = role === "product" ? "management" : "sales";

  if (!username || !password) {
    setAdminUserStatus("Введите логин и пароль.", "var(--tone-error)");
    return;
  }

  setAdminUserStatus("Создаю пользователя...", "var(--tone-warn)");
  try {
    await apiRequest("/api/admin/users", {
      method: "POST",
      body: { username, password, name, role, department }
    });
    if (adminUserCreateForm) {
      adminUserCreateForm.reset();
    }
    await loadAdminUsers();
    setAdminUserStatus("Пользователь создан.", "var(--tone-ok)");
  } catch {
    setAdminUserStatus("Не удалось создать пользователя.", "var(--tone-error)");
  }
}

function readPlanTarget(node) {
  const value = Number(node?.value);
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

async function saveOwnerPlan(event) {
  event.preventDefault();
  if (actor?.role !== "owner") {
    return;
  }

  const dayTarget = readPlanTarget(ownerPlanDay);
  const weekTarget = readPlanTarget(ownerPlanWeek);
  const monthTarget = readPlanTarget(ownerPlanMonth);

  setText(ownerPlanStatus, "Сохраняю план владельца...", "var(--tone-warn)");
  try {
    await apiRequest("/api/admin/plans", {
      method: "PATCH",
      body: {
        dayTarget,
        weekTarget,
        monthTarget
      }
    });
    await loadDashboard({ silent: true });
    setText(ownerPlanStatus, "План владельца обновлен.", "var(--tone-ok)");
  } catch {
    setText(ownerPlanStatus, "Не удалось сохранить план владельца.", "var(--tone-error)");
  }
}

function getLoadErrorMessage(error) {
  if (error?.name === "TypeError") {
    return "Backend недоступен. Проверьте WELONE_API_BASE в config.js и CORS.";
  }
  if (error?.status === 404 || error?.message === "HTTP_404") {
    return "API /api не найден (404). Нужен backend сервер.";
  }
  if (error?.message === "FORBIDDEN_STATS") {
    return "Для вашей роли статистика недоступна.";
  }
  return "Не удалось загрузить панель.";
}

async function loadDashboard(options = {}) {
  const { silent = false } = options;
  if (busy && !silent) {
    return;
  }

  if (!silent) {
    setBusy(true);
    setText(adminStatus, "Загружаю данные панели...", "var(--tone-warn)");
  }

  try {
    const [stats, team] = await Promise.all([
      apiRequest("/api/admin/stats"),
      apiRequest("/api/admin/team")
    ]);

    statsPayload = stats;
    teamPayload = team;
    actor = stats.actor || team.actor || null;
    permissions = stats.permissions || team.permissions || {};

    const showTrainingNav = actor?.role === "product" || actor?.role === "manager";
    setTrainingNavVisible(showTrainingNav && permissions.canAccessTraining !== false);
    renderActorMeta();
    renderGeneralStats(stats);
    renderRolePanels(stats);

    if (actor?.role === "owner") {
      await loadAdminUsers();
      setAdminUserStatus("Владелец добавляет сотрудников по логину и паролю.", "var(--tone-info)");
    } else {
      setRolePanelVisible(adminTeamSection, false);
      if (adminUserList) {
        adminUserList.innerHTML = "";
      }
    }

    setText(adminStatus, "Панель обновлена.", "var(--tone-ok)");
  } catch (error) {
    setText(adminStatus, getLoadErrorMessage(error), "var(--tone-error)");
  } finally {
    if (!silent) {
      setBusy(false);
    }
  }
}

if (!apiAllowed) {
  setTrainingNavVisible(false);
  if (adminAuth) {
    adminAuth.hidden = false;
  }
  if (adminPanel) {
    adminPanel.hidden = false;
    adminPanel.setAttribute("aria-hidden", "false");
  }
  setText(adminStatus, "Откройте через сервер: http://localhost:3000/admin.html", "var(--tone-error)");
} else {
  setTrainingNavVisible(true);
  if (adminAuth) {
    adminAuth.hidden = true;
  }
  if (adminPanel) {
    adminPanel.hidden = false;
    adminPanel.setAttribute("aria-hidden", "false");
  }
  loadDashboard();

  if (refreshAdmin) {
    refreshAdmin.addEventListener("click", () => {
      loadDashboard();
    });
  }

  if (adminUserCreateForm) {
    adminUserCreateForm.addEventListener("submit", createUser);
  }
  if (ownerPlanForm) {
    ownerPlanForm.addEventListener("submit", saveOwnerPlan);
  }
}
