"use strict";

const adminAuth = document.getElementById("adminAuth");
const adminPanel = document.getElementById("adminPanel");
const adminStatus = document.getElementById("adminStatus");
const adminUserMeta = document.getElementById("adminUserMeta");
const adminStats = document.getElementById("adminStats");
const adminStatsHint = document.getElementById("adminStatsHint");
const refreshAdmin = document.getElementById("refreshAdmin");
const adminTeamSection = document.getElementById("adminTeamSection");
const adminUserCreateForm = document.getElementById("adminUserCreateForm");
const adminCreateUsername = document.getElementById("adminCreateUsername");
const adminCreateName = document.getElementById("adminCreateName");
const adminCreateDepartment = document.getElementById("adminCreateDepartment");
const adminUserStatus = document.getElementById("adminUserStatus");
const adminUserList = document.getElementById("adminUserList");

const apiAllowed = window.location.protocol === "http:" || window.location.protocol === "https:";
const roleLabels = {
  owner: "Владелец",
  help: "Help",
  manager: "Руководитель",
  worker: "Сотрудник"
};

let token = "";
let actor = null;
let permissions = {};
let isBusy = false;
let adminUsers = [];

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

function setAuthVisible(isVisible) {
  if (adminAuth) {
    adminAuth.hidden = !isVisible;
    adminAuth.setAttribute("aria-hidden", String(!isVisible));
  }
  if (adminPanel) {
    adminPanel.hidden = isVisible;
    adminPanel.setAttribute("aria-hidden", String(isVisible));
  }
}

function setTeamSectionVisible(isVisible) {
  if (!adminTeamSection) {
    return;
  }
  adminTeamSection.hidden = !isVisible;
  adminTeamSection.setAttribute("aria-hidden", String(!isVisible));
}

function setBusyState(nextBusy) {
  isBusy = nextBusy;
  if (refreshAdmin) {
    refreshAdmin.disabled = nextBusy;
  }
}

function clearSession(message) {
  token = "";
  actor = null;
  permissions = {};
  adminUsers = [];
  setAuthVisible(false);
  setStatsVisibility(false);
  setTeamSectionVisible(false);
  resetStats();
  if (adminUserList) {
    adminUserList.innerHTML = "";
  }
  if (adminUserStatus) {
    setText(adminUserStatus, "Только владелец может управлять сотрудниками.", "var(--tone-info)");
  }
  if (message) {
    setText(adminStatus, message, "var(--tone-error)");
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function formatDuration(msValue) {
  const ms = Math.max(0, Number(msValue) || 0);
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

function resetStats() {
  setStatValue("todayUniqueVisitors", "0");
  setStatValue("todayRepeatVisits", "0");
  setStatValue("avgViewTime", "0:00");
  setStatValue("secretFindsTotal", "0");
  setStatValue("leadsTotal", "0");
  setStatValue("leadsNew", "0");
  setStatValue("leadsUnassigned", "0");
}

function renderStats(stats) {
  setStatValue("todayUniqueVisitors", formatNumber(stats.todayUniqueVisitors));
  setStatValue("todayRepeatVisits", formatNumber(stats.todayRepeatVisits));
  setStatValue("avgViewTime", formatDuration(stats.avgViewMs));
  setStatValue("secretFindsTotal", formatNumber(stats.secretFindsTotal));
  setStatValue("leadsTotal", formatNumber(stats.leadsTotal));
  setStatValue("leadsNew", formatNumber(stats.leadsNew));
  setStatValue("leadsUnassigned", formatNumber(stats.leadsUnassigned));
}

function setStatsVisibility(isVisible) {
  if (adminStats) {
    adminStats.hidden = !isVisible;
    adminStats.setAttribute("aria-hidden", String(!isVisible));
  }
  if (adminStatsHint) {
    adminStatsHint.hidden = isVisible;
    if (!isVisible) {
      adminStatsHint.textContent =
        "Сводная статистика доступна только роли владельца. Для работы команды откройте раздел заявок.";
    }
  }
}

function renderActorMeta() {
  if (!adminUserMeta || !actor) {
    return;
  }

  const roleLabel = roleLabels[actor.role] || actor.role || "Сотрудник";
  const departmentLabel = prettifyDepartment(actor.department);
  const displayName = actor.name || actor.username || actor.id || "Пользователь";
  adminUserMeta.textContent = `${displayName} • ${roleLabel} • ${departmentLabel}`;
}

function redirectToLeads() {
  window.location.href = "admin-leads.html";
}

function setAdminUserStatus(message, color) {
  setText(adminUserStatus, message, color);
}

function isSystemHelpUser(user) {
  return user && (user.id === "sales_help" || user.id === "production_help");
}

function renderAdminUsers() {
  if (!adminUserList) {
    return;
  }

  const helpUsers = adminUsers.filter((user) => user.role === "help");
  adminUserList.innerHTML = "";

  if (helpUsers.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Сотрудников help пока нет.";
    adminUserList.appendChild(empty);
    return;
  }

  helpUsers.forEach((user) => {
    const row = document.createElement("div");
    row.className = "admin-team__item";

    const meta = document.createElement("div");
    meta.className = "admin-team__meta";

    const title = document.createElement("strong");
    title.textContent = `${user.name || user.username} (@${user.username})`;
    const subtitle = document.createElement("span");
    const systemTag = isSystemHelpUser(user) ? "системный" : "пользовательский";
    subtitle.textContent = `${prettifyDepartment(user.department)} • ${systemTag}`;
    meta.append(title, subtitle);

    const actions = document.createElement("div");
    actions.className = "admin-team__actions";

    if (!isSystemHelpUser(user)) {
      const deleteButton = document.createElement("button");
      deleteButton.className = "btn btn--ghost";
      deleteButton.type = "button";
      deleteButton.textContent = "Удалить";
      deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(`Удалить пользователя ${user.username}?`);
        if (!confirmed) {
          return;
        }
        await removeHelpUser(user);
      });
      actions.appendChild(deleteButton);
    }

    row.append(meta, actions);
    adminUserList.appendChild(row);
  });
}

function resolveAdminLoadError(error, fallbackMessage) {
  if (!error) {
    return fallbackMessage;
  }

  if (error.name === "TypeError") {
    return "Backend недоступен. Проверьте WELONE_API_BASE в config.js и CORS на backend.";
  }

  if (error.message === "DB_BINDING_MISSING") {
    return "Backend запущен без базы данных (DB_BINDING_MISSING). Настройте DB/D1 и повторите.";
  }

  if (error.status === 404 || error.message === "HTTP_404") {
    return "API /api не найден (404). GitHub Pages не запускает backend: нужен отдельный сервер/API.";
  }

  return fallbackMessage;
}

function resolveAdminUserError(error, fallbackMessage) {
  if (error.status === 401) {
    return "Доступ без авторизации недоступен. Проверьте backend.";
  }

  const map = {
    FORBIDDEN_USERS: "Только владелец может управлять сотрудниками.",
    FORBIDDEN_OWNER_EDIT: "Нельзя изменять владельца.",
    FORBIDDEN_SYSTEM_USER: "Системных пользователей изменить нельзя.",
    USERNAME_REQUIRED: "Укажите логин.",
    USERNAME_PASSWORD_REQUIRED: "Укажите логин.",
    INVALID_USERNAME: "Некорректный логин.",
    INVALID_PASSWORD: "Некорректный пароль.",
    USERNAME_TAKEN: "Логин уже занят.",
    USER_NOT_FOUND: "Пользователь не найден."
  };

  return map[error.message] || fallbackMessage;
}

async function loadAdminUsers() {
  if (actor?.role !== "owner") {
    setTeamSectionVisible(false);
    return;
  }

  setTeamSectionVisible(true);
  const payload = await apiRequest("/api/admin/users");
  adminUsers = Array.isArray(payload.users) ? payload.users : [];
  renderAdminUsers();
  setAdminUserStatus(
    `Сотрудников help: ${adminUsers.filter((user) => user.role === "help").length}.`,
    "var(--tone-info)"
  );
}

async function createHelpUser(event) {
  event.preventDefault();
  if (actor?.role !== "owner") {
    return;
  }

  const username = String(adminCreateUsername?.value || "").trim();
  const name = String(adminCreateName?.value || "").trim();
  const department = String(adminCreateDepartment?.value || "").trim();

  if (!username || !name || !department) {
    setAdminUserStatus("Заполните все поля.", "var(--tone-error)");
    return;
  }

  setAdminUserStatus("Создаю сотрудника...", "var(--tone-warn)");

  try {
    await apiRequest("/api/admin/users", {
      method: "POST",
      body: { username, name, department }
    });
    if (adminUserCreateForm) {
      adminUserCreateForm.reset();
    }
    await loadAdminUsers();
    setAdminUserStatus("Сотрудник добавлен.", "var(--tone-ok)");
  } catch (error) {
    const message = resolveAdminUserError(error, "Не удалось создать сотрудника.");
    if (message) {
      setAdminUserStatus(message, "var(--tone-error)");
    }
  }
}

async function updateHelpUser(user, patchBody) {
  setAdminUserStatus("Сохраняю изменения...", "var(--tone-warn)");
  try {
    await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      body: patchBody
    });
    await loadAdminUsers();
    setAdminUserStatus(`Данные пользователя ${user.username} обновлены.`, "var(--tone-ok)");
  } catch (error) {
    const message = resolveAdminUserError(error, "Не удалось обновить пользователя.");
    if (message) {
      setAdminUserStatus(message, "var(--tone-error)");
    }
  }
}

async function removeHelpUser(user) {
  setAdminUserStatus("Удаляю сотрудника...", "var(--tone-warn)");
  try {
    const payload = await apiRequest(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "DELETE"
    });
    await loadAdminUsers();
    const unassigned = Number(payload.unassignedLeads) || 0;
    if (unassigned > 0) {
      setAdminUserStatus(
        `Пользователь удален. Заявок снято с назначения: ${unassigned}.`,
        "var(--tone-ok)"
      );
    } else {
      setAdminUserStatus("Пользователь удален.", "var(--tone-ok)");
    }
  } catch (error) {
    const message = resolveAdminUserError(error, "Не удалось удалить пользователя.");
    if (message) {
      setAdminUserStatus(message, "var(--tone-error)");
    }
  }
}

async function apiRequest(path, options = {}) {
  const { method = "GET", body } = options;
  const headers = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

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

async function loadProfile() {
  const payload = await apiRequest("/api/admin/me");
  actor = payload.actor || null;
  permissions = payload.permissions || {};
  renderActorMeta();
}

async function loadStats() {
  setStatsVisibility(true);
  const payload = await apiRequest("/api/admin/stats");
  renderStats(payload);
}

async function refreshDashboard() {
  if (isBusy) {
    return;
  }

  setBusyState(true);
  try {
    setTeamSectionVisible(false);
    await loadStats();
    setText(adminStatus, "Данные обновлены.", "var(--tone-ok)");
  } catch (error) {
    setText(adminStatus, resolveAdminLoadError(error, "Не удалось обновить данные."), "var(--tone-error)");
  } finally {
    setBusyState(false);
  }
}

async function restoreSession() {
  setAuthVisible(false);
  setTeamSectionVisible(false);
  setBusyState(true);
  setText(adminStatus, "Загружаем статистику...", "var(--tone-warn)");
  setText(adminUserMeta, "Статистика доступна без логина.", "var(--tone-info)");

  try {
    await loadStats();
    setText(adminStatus, "Панель готова к работе.", "var(--tone-info)");
  } catch (error) {
    setText(adminStatus, resolveAdminLoadError(error, "Не удалось загрузить панель."), "var(--tone-error)");
  } finally {
    setBusyState(false);
  }
}

if (!apiAllowed) {
  setAuthVisible(false);
  resetStats();
  setStatsVisibility(false);
  setText(adminStatus, "Откройте через сервер: http://localhost:3000/admin.html", "var(--tone-error)");
} else {
  token = "";
  restoreSession();

  if (refreshAdmin) {
    refreshAdmin.addEventListener("click", refreshDashboard);
  }

  setTeamSectionVisible(false);
}

