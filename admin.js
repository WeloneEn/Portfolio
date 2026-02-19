"use strict";


const adminAuth = document.getElementById("adminAuth");
const adminPanel = document.getElementById("adminPanel");
const adminStatus = document.getElementById("adminStatus");
const adminUserMeta = document.getElementById("adminUserMeta");
const refreshAdmin = document.getElementById("refreshAdmin");
const trainingNavLinks = Array.from(document.querySelectorAll('a[href="admin-training.html"]'));

const ownerPanel = document.getElementById("ownerPanel");
const ownerPlanForm = document.getElementById("ownerPlanForm");
const planDayTarget = document.getElementById("planDayTarget");
const planWeekTarget = document.getElementById("planWeekTarget");
const planMonthTarget = document.getElementById("planMonthTarget");
const ownerPlanStatus = document.getElementById("ownerPlanStatus");
const ownerPlanProgress = document.getElementById("ownerPlanProgress");

const productPanel = document.getElementById("productPanel");
const productPanelStatus = document.getElementById("productPanelStatus");
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
const adminCreateName = document.getElementById("adminCreateName");
const adminCreateRole = document.getElementById("adminCreateRole");
const adminCreateDepartment = document.getElementById("adminCreateDepartment");
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

function setTrainingNavVisible(isVisible) {
  trainingNavLinks.forEach((link) => {
    link.classList.toggle("is-hidden-link", !isVisible);
    link.setAttribute("aria-hidden", String(!isVisible));
    link.tabIndex = isVisible ? 0 : -1;
  });
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
  setStatValue("pointsThisMonth", formatNumber(stats.pointsThisMonth));
}

function renderOwnerPanel(stats) {
  if (!ownerPanel || !ownerPlanProgress) {
    return;
  }

  const plans = stats?.plans || {};
  const day = plans.day || {};
  const week = plans.week || {};
  const month = plans.month || {};

  if (planDayTarget) {
    planDayTarget.value = String(day.target || 0);
  }
  if (planWeekTarget) {
    planWeekTarget.value = String(week.target || 0);
  }
  if (planMonthTarget) {
    planMonthTarget.value = String(month.target || 0);
  }

  ownerPlanProgress.innerHTML = "";
  ownerPlanProgress.append(
    createKpiCard("День", `${formatNumber(day.achieved)} / ${formatNumber(day.target)}`, `Выполнение: ${formatPercent(day.completionPercent)}`),
    createKpiCard("Неделя", `${formatNumber(week.achieved)} / ${formatNumber(week.target)}`, `Выполнение: ${formatPercent(week.completionPercent)}`),
    createKpiCard("Месяц", `${formatNumber(month.achieved)} / ${formatNumber(month.target)}`, `Выполнение: ${formatPercent(month.completionPercent)}`)
  );
  setText(ownerPlanStatus, "План считается только по успешным сделкам менеджеров.", "var(--tone-info)");
}

function renderProductPanel(stats) {
  if (!productPanel || !productTopStats || !productManagerStats || !productLeaderboard) {
    return;
  }

  const perf = stats?.managerPerformance || {};
  const managers = Array.isArray(perf.managers) ? perf.managers : [];
  const leaderboard = Array.isArray(perf.leaderboard) ? perf.leaderboard : [];

  productTopStats.innerHTML = "";
  productTopStats.append(
    createKpiCard("Менеджеров", formatNumber(perf.managerCount || managers.length), "Роль менеджер"),
    createKpiCard("Сделки за месяц", formatNumber(managers.reduce((acc, row) => acc + (Number(row.periods?.month?.success) || 0), 0)), "Успешные"),
    createKpiCard("Очки команды", formatNumber(managers.reduce((acc, row) => acc + (Number(row.periods?.month?.points) || 0), 0)), "За 30 дней")
  );

  productManagerStats.innerHTML = "";
  if (!managers.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Менеджеры не найдены.";
    productManagerStats.appendChild(empty);
  } else {
    managers.forEach((row) => {
      const userName = row.user?.name || row.user?.username || row.userId;
      const meta =
        `День ${formatNumber(row.periods?.day?.success)}/${formatNumber(row.periods?.day?.planTarget)} • ` +
        `Неделя ${formatNumber(row.periods?.week?.success)}/${formatNumber(row.periods?.week?.planTarget)} • ` +
        `Месяц ${formatNumber(row.periods?.month?.success)}/${formatNumber(row.periods?.month?.planTarget)} • ` +
        `Очки ${formatNumber(row.periods?.month?.points)}`;
      productManagerStats.appendChild(createSimpleRow(userName, meta));
    });
  }

  productLeaderboard.innerHTML = "";
  if (!leaderboard.length) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Leaderboard пока пуст.";
    productLeaderboard.appendChild(empty);
  } else {
    leaderboard.slice(0, 10).forEach((entry) => {
      const userName = entry.user?.name || entry.user?.username || entry.userId;
      const meta = `Очки ${formatNumber(entry.periods?.month?.points)} • Сделки ${formatNumber(entry.periods?.month?.success)}`;
      productLeaderboard.appendChild(createSimpleRow(`#${entry.rank} ${userName}`, meta));
    });
  }

  setText(productPanelStatus, "Подробная статистика по менеджерам за день, неделю и месяц.", "var(--tone-info)");
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
      createKpiCard("Месяц", `${formatNumber(self.periods?.month?.success)} / ${formatNumber(self.periods?.month?.planTarget)}`, `Выполнение: ${formatPercent(self.periods?.month?.planCompletionPercent)}`),
      createKpiCard("Очки за месяц", formatNumber(self.periods?.month?.points), "Система очков"),
      createKpiCard("Очки всего", formatNumber(self.totals?.points), "Накопительно")
    );
  }

  managerLeaderboardSnippet.innerHTML = "";
  if (leaderboard.length) {
    leaderboard.slice(0, 5).forEach((entry) => {
      const userName = entry.user?.name || entry.user?.username || entry.userId;
      managerLeaderboardSnippet.appendChild(
        createSimpleRow(`#${entry.rank} ${userName}`, `Очки ${formatNumber(entry.periods?.month?.points)} • Сделки ${formatNumber(entry.periods?.month?.success)}`)
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
  setRolePanelVisible(ownerPanel, role === "owner");
  setRolePanelVisible(productPanel, role === "product");
  setRolePanelVisible(managerPanel, role === "manager");
  setRolePanelVisible(trainingAssignSection, Boolean(permissions.canManageTrainingAssignments));

  if (role === "owner") {
    renderOwnerPanel(stats);
  }
  if (role === "product") {
    renderProductPanel(stats);
  }
  if (role === "manager") {
    renderManagerPanel(stats);
  }
  if (permissions.canManageTrainingAssignments) {
    renderTrainingAssignments();
  }
}

async function createUser(event) {
  event.preventDefault();
  if (actor?.role !== "owner") {
    return;
  }

  const username = String(adminCreateUsername?.value || "").trim();
  const password = String(adminCreatePassword?.value || "").trim();
  const name = String(adminCreateName?.value || "").trim();
  const role = String(adminCreateRole?.value || "manager").trim();
  const department = String(adminCreateDepartment?.value || "").trim();

  if (!username || !password || !name || !department) {
    setAdminUserStatus("Заполните все поля.", "var(--tone-error)");
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

async function saveOwnerPlan(event) {
  event.preventDefault();
  if (actor?.role !== "owner") {
    return;
  }

  const dayTarget = Math.max(0, Math.round(Number(planDayTarget?.value) || 0));
  const weekTarget = Math.max(0, Math.round(Number(planWeekTarget?.value) || 0));
  const monthTarget = Math.max(0, Math.round(Number(planMonthTarget?.value) || 0));

  setText(ownerPlanStatus, "Сохраняю план...", "var(--tone-warn)");
  try {
    await apiRequest("/api/admin/plans", {
      method: "PATCH",
      body: { dayTarget, weekTarget, monthTarget }
    });
    await loadDashboard({ silent: true });
    setText(ownerPlanStatus, "План обновлен.", "var(--tone-ok)");
  } catch {
    setText(ownerPlanStatus, "Не удалось обновить план.", "var(--tone-error)");
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

    setTrainingNavVisible(permissions.canAccessTraining !== false);
    renderActorMeta();
    renderGeneralStats(stats);
    renderRolePanels(stats);

    if (actor?.role === "owner") {
      await loadAdminUsers();
      setAdminUserStatus("Только владелец управляет сотрудниками.", "var(--tone-info)");
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

  if (ownerPlanForm) {
    ownerPlanForm.addEventListener("submit", saveOwnerPlan);
  }

  if (adminUserCreateForm) {
    adminUserCreateForm.addEventListener("submit", createUser);
  }
}
