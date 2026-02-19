"use strict";

const authRequired = document.getElementById("authRequired");
const leadsAuthStatus = document.getElementById("leadsAuthStatus");
const leadsPanel = document.getElementById("leadsPanel");
const leadsActorMeta = document.getElementById("leadsActorMeta");
const leadsStatus = document.getElementById("leadsStatus");
const leadsOps = document.getElementById("leadsOps");
const leadsOpsHint = document.getElementById("leadsOpsHint");
const leadsOpsStatus = document.getElementById("leadsOpsStatus");
const takeNextLead = document.getElementById("takeNextLead");
const takeNextLeadFab = document.getElementById("takeNextLeadFab");
const leadsSummary = document.getElementById("leadsSummary");
const leadsList = document.getElementById("leadsList");
const refreshLeads = document.getElementById("refreshLeads");
const ownerAdminLink = document.getElementById("ownerAdminLink");
const leadsAdminNavLink = document.getElementById("leadsAdminNavLink");
const leadSearch = document.getElementById("leadSearch");
const leadSortMode = document.getElementById("leadSortMode");
const leadDepartmentFilter = document.getElementById("leadDepartmentFilter");
const leadAssigneeFilter = document.getElementById("leadAssigneeFilter");
const resetLeadFilters = document.getElementById("resetLeadFilters");

const apiAllowed = window.location.protocol === "http:" || window.location.protocol === "https:";

function resolveApiUrl(path) {
  const helper = window.WELONE_API && typeof window.WELONE_API.url === "function" ? window.WELONE_API.url : null;
  if (helper) {
    return helper(path);
  }

  const rel = String(path || "").trim().replace(/^\/+/, "");
  return new URL(rel, `${window.location.origin}/`).toString();
}

const roleLabels = {
  owner: "Владелец",
  help: "Help",
  manager: "Руководитель",
  worker: "Сотрудник"
};

const statusLabels = {
  new: "Новая",
  in_progress: "В работе",
  done: "Завершена"
};

const priorityLabels = {
  low: "Низкий",
  normal: "Обычный",
  high: "Высокий"
};

const flowLabels = {
  all: "Все заявки",
  new: "Новые",
  in_progress: "В работе",
  done: "Завершенные",
  unassigned: "Без исполнителя"
};

const flowHints = {
  new: "Первичная обработка и назначение исполнителя.",
  in_progress: "Активные заявки в производстве.",
  done: "Архив завершенных обращений.",
  unassigned: "Требуют назначения ответственного."
};

const sortLabels = {
  queue: "очереди",
  priority: "приоритету",
  newest: "новизне",
  oldest: "дате создания",
  updated: "дате обновления"
};

const statusSortOrder = {
  new: 0,
  in_progress: 1,
  done: 2
};

const prioritySortOrder = {
  high: 0,
  normal: 1,
  low: 2
};

const quickStatusTransitions = {
  new: { status: "in_progress", label: "В работу" },
  in_progress: { status: "done", label: "Завершить" },
  done: { status: "in_progress", label: "Вернуть в работу" }
};

const errorMessages = {
  FORBIDDEN: "Недостаточно прав для этой заявки.",
  FORBIDDEN_STATUS: "Недостаточно прав для смены статуса.",
  FORBIDDEN_PRIORITY: "Недостаточно прав для смены приоритета.",
  FORBIDDEN_NOTE: "Недостаточно прав для редактирования заметки.",
  FORBIDDEN_COMMENT: "Недостаточно прав для комментария.",
  FORBIDDEN_ASSIGNMENT: "Недостаточно прав для назначения.",
  FORBIDDEN_ASSIGNEE: "Нельзя назначить этого сотрудника.",
  FORBIDDEN_DEPARTMENT: "Нельзя назначить этот отдел.",
  ASSIGNEE_NOT_FOUND: "Сотрудник для назначения не найден.",
  COMMENT_REQUIRED: "Введите текст комментария.",
  LEAD_NOT_FOUND: "Заявка не найдена."
};

let token = "";
let actor = null;
let permissions = {};
let teamUsers = [];
let visibleDepartments = [];
let allLeads = [];
let activeFlow = "all";
const pendingLeadIds = new Set();
let focusedLeadId = String(new URLSearchParams(window.location.search).get("lead") || "").trim();
let shouldScrollToFocusedLead = Boolean(focusedLeadId);

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

function setAuthRequiredState(isRequired) {
  if (authRequired) {
    authRequired.hidden = !isRequired;
    authRequired.setAttribute("aria-hidden", String(!isRequired));
  }
  if (leadsPanel) {
    leadsPanel.hidden = isRequired;
    leadsPanel.setAttribute("aria-hidden", String(isRequired));
  }
  if (isRequired) {
    setTakeNextButtonsState(false, "Взять следующую");
  }
}

function setOwnerAdminVisible(isVisible) {
  if (ownerAdminLink) {
    ownerAdminLink.classList.toggle("is-hidden-link", !isVisible);
    ownerAdminLink.setAttribute("aria-hidden", String(!isVisible));
    ownerAdminLink.tabIndex = isVisible ? 0 : -1;
  }
  if (leadsAdminNavLink) {
    leadsAdminNavLink.classList.toggle("is-hidden-link", !isVisible);
    leadsAdminNavLink.setAttribute("aria-hidden", String(!isVisible));
    leadsAdminNavLink.tabIndex = isVisible ? 0 : -1;
  }
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function asTimestamp(value) {
  const result = Date.parse(String(value || ""));
  return Number.isFinite(result) ? result : 0;
}

function normalizeForSearch(value) {
  return String(value || "").toLowerCase().trim();
}

function normalizeLeadStatus(value) {
  const raw = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(statusLabels, raw) ? raw : "new";
}

function normalizeLeadPriority(value) {
  const raw = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(priorityLabels, raw) ? raw : "normal";
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

function buildSelectOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

function canAssignLeads() {
  return Boolean(permissions && permissions.canAssignLeads);
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

function handleApiError(error, fallbackMessage) {
  if (error && error.name === "TypeError") {
    setText(leadsStatus, "Backend недоступен. Проверьте WELONE_API_BASE в config.js и CORS на backend.", "var(--tone-error)");
    return;
  }

  if (error && error.message === "DB_BINDING_MISSING") {
    setText(leadsStatus, "Backend запущен без базы данных (DB_BINDING_MISSING). Настройте DB/D1 и повторите.", "var(--tone-error)");
    return;
  }

  if (error && error.status === 404 && error.message === "LEAD_NOT_FOUND") {
    setText(leadsStatus, errorMessages.LEAD_NOT_FOUND, "var(--tone-error)");
    return;
  }

  if (error && (error.status === 404 || error.message === "HTTP_404")) {
    setText(leadsStatus, "API /api не найден (404). GitHub Pages не запускает backend: нужен отдельный сервер/API.", "var(--tone-error)");
    return;
  }

  if (error && error.status === 401) {
    setText(leadsStatus, "Доступ без авторизации недоступен. Проверьте backend.", "var(--tone-error)");
    return;
  }

  if (error && error.status === 403) {
    const message = errorMessages[error.message] || "Недостаточно прав для этого действия.";
    setText(leadsStatus, message, "var(--tone-error)");
    return;
  }

  if (error && error.status === 400 && errorMessages[error.message]) {
    setText(leadsStatus, errorMessages[error.message], "var(--tone-error)");
    return;
  }

  setText(leadsStatus, fallbackMessage, "var(--tone-error)");
}

function refreshActorMeta() {
  if (!leadsActorMeta || !actor) {
    return;
  }

  const role = roleLabels[actor.role] || actor.role || "Сотрудник";
  const department = prettifyDepartment(actor.department);
  const name = actor.name || actor.username || actor.id || "Пользователь";
  const scope = permissions.canViewAllLeads ? "видит все заявки" : "видит заявки своего контура";
  leadsActorMeta.textContent = `${name} • ${role} • ${department} • ${scope}`;
}

function collectDepartments() {
  const departments = new Set();
  departments.add("unassigned");
  visibleDepartments.forEach((item) => departments.add(String(item || "").trim() || "unassigned"));
  allLeads.forEach((lead) => departments.add(String(lead.department || "").trim() || "unassigned"));

  return Array.from(departments).sort((left, right) => {
    if (left === "unassigned") {
      return -1;
    }
    if (right === "unassigned") {
      return 1;
    }
    return left.localeCompare(right, "ru");
  });
}

function collectAssignees() {
  const map = new Map();

  teamUsers.forEach((user) => {
    if (!user || !user.id) {
      return;
    }
    map.set(user.id, {
      id: user.id,
      name: user.name || user.username || user.id,
      department: user.department || "unassigned"
    });
  });

  allLeads.forEach((lead) => {
    if (!lead.assigneeId || map.has(lead.assigneeId)) {
      return;
    }
    map.set(lead.assigneeId, {
      id: lead.assigneeId,
      name: lead.assigneeName || lead.assigneeId,
      department: lead.department || "unassigned"
    });
  });

  return Array.from(map.values()).sort((left, right) =>
    left.name.localeCompare(right.name, "ru")
  );
}

function refreshFilterOptions() {
  if (leadDepartmentFilter) {
    const selected = leadDepartmentFilter.value;
    leadDepartmentFilter.innerHTML = "";
    leadDepartmentFilter.appendChild(buildSelectOption("", "Все отделы"));

    collectDepartments().forEach((department) => {
      leadDepartmentFilter.appendChild(
        buildSelectOption(department, prettifyDepartment(department))
      );
    });

    if (
      selected &&
      Array.from(leadDepartmentFilter.options).some((option) => option.value === selected)
    ) {
      leadDepartmentFilter.value = selected;
    }
  }

  if (leadAssigneeFilter) {
    const selected = leadAssigneeFilter.value;
    leadAssigneeFilter.innerHTML = "";
    leadAssigneeFilter.appendChild(buildSelectOption("", "Все исполнители"));

    collectAssignees().forEach((user) => {
      leadAssigneeFilter.appendChild(buildSelectOption(user.id, user.name));
    });

    if (
      selected &&
      Array.from(leadAssigneeFilter.options).some((option) => option.value === selected)
    ) {
      leadAssigneeFilter.value = selected;
    }
  }

  syncFilterState();
}

function syncFilterState() {
  if (!leadAssigneeFilter) {
    return;
  }

  const isUnassignedFlow = activeFlow === "unassigned";
  if (isUnassignedFlow && leadAssigneeFilter.value) {
    leadAssigneeFilter.value = "";
  }
  leadAssigneeFilter.disabled = isUnassignedFlow;
}

function updateFocusedLeadUrl() {
  const currentUrl = new URL(window.location.href);
  if (focusedLeadId) {
    currentUrl.searchParams.set("lead", focusedLeadId);
  } else {
    currentUrl.searchParams.delete("lead");
  }
  window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
}

function setFocusedLead(leadId, shouldScroll) {
  focusedLeadId = String(leadId || "").trim();
  shouldScrollToFocusedLead = Boolean(shouldScroll && focusedLeadId);
  updateFocusedLeadUrl();
}

function findLeadCardById(leadId) {
  if (!leadId || !leadsList) {
    return null;
  }

  const cards = Array.from(leadsList.querySelectorAll(".lead-item"));
  return cards.find((card) => String(card.dataset.leadId || "") === String(leadId)) || null;
}

function scrollToFocusedLeadIfNeeded() {
  if (!shouldScrollToFocusedLead || !focusedLeadId) {
    return;
  }

  const target = findLeadCardById(focusedLeadId);
  shouldScrollToFocusedLead = false;
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function matchesActiveFlow(lead) {
  const status = normalizeLeadStatus(lead.status);
  if (activeFlow === "all") {
    return true;
  }
  if (activeFlow === "unassigned") {
    return !lead.assigneeId;
  }
  return status === activeFlow;
}

function getFilteredLeads() {
  const query = normalizeForSearch(leadSearch?.value || "");
  const departmentFilterValue = String(leadDepartmentFilter?.value || "");
  const assigneeFilterValue = String(leadAssigneeFilter?.value || "");

  return allLeads.filter((lead) => {
    if (!matchesActiveFlow(lead)) {
      return false;
    }
    if (departmentFilterValue && (lead.department || "unassigned") !== departmentFilterValue) {
      return false;
    }
    if (assigneeFilterValue && (lead.assigneeId || "") !== assigneeFilterValue) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchBlob = [
      lead.id,
      lead.name,
      lead.contact,
      lead.type,
      lead.message,
      lead.sourcePage,
      lead.assigneeName,
      lead.internalNote
    ]
      .map((item) => normalizeForSearch(item))
      .join(" ");

    return searchBlob.includes(query);
  });
}

function sortLeads(leads) {
  const mode = String(leadSortMode?.value || "queue");

  const list = Array.isArray(leads) ? [...leads] : [];
  list.sort((left, right) => {
    const leftStatus = normalizeLeadStatus(left.status);
    const rightStatus = normalizeLeadStatus(right.status);
    const leftPriority = normalizeLeadPriority(left.priority);
    const rightPriority = normalizeLeadPriority(right.priority);
    const leftCreated = asTimestamp(left.createdAt);
    const rightCreated = asTimestamp(right.createdAt);
    const leftUpdated = asTimestamp(left.updatedAt || left.createdAt);
    const rightUpdated = asTimestamp(right.updatedAt || right.createdAt);

    if (mode === "priority") {
      const byPriority = (prioritySortOrder[leftPriority] ?? 99) - (prioritySortOrder[rightPriority] ?? 99);
      if (byPriority !== 0) {
        return byPriority;
      }
      const byStatus = (statusSortOrder[leftStatus] ?? 99) - (statusSortOrder[rightStatus] ?? 99);
      if (byStatus !== 0) {
        return byStatus;
      }
      return rightCreated - leftCreated;
    }

    if (mode === "newest") {
      return rightCreated - leftCreated;
    }

    if (mode === "oldest") {
      return leftCreated - rightCreated;
    }

    if (mode === "updated") {
      const byUpdated = rightUpdated - leftUpdated;
      if (byUpdated !== 0) {
        return byUpdated;
      }
      return rightCreated - leftCreated;
    }

    const byStatus = (statusSortOrder[leftStatus] ?? 99) - (statusSortOrder[rightStatus] ?? 99);
    if (byStatus !== 0) {
      return byStatus;
    }
    const byPriority = (prioritySortOrder[leftPriority] ?? 99) - (prioritySortOrder[rightPriority] ?? 99);
    if (byPriority !== 0) {
      return byPriority;
    }
    return rightCreated - leftCreated;
  });

  return list;
}

function leadDisplayName(lead) {
  return lead?.name || lead?.contact || lead?.id || "Без имени";
}

function isOperationalLead(lead) {
  const status = normalizeLeadStatus(lead?.status);
  if (status === "done") {
    return false;
  }
  if (!lead?.assigneeId) {
    return true;
  }
  return status === "new" && Boolean(actor?.id) && lead.assigneeId === actor.id;
}

function sortOperationalQueue(leads) {
  const queue = Array.isArray(leads) ? [...leads] : [];
  queue.sort((left, right) => {
    const leftUnassigned = left.assigneeId ? 1 : 0;
    const rightUnassigned = right.assigneeId ? 1 : 0;
    if (leftUnassigned !== rightUnassigned) {
      return leftUnassigned - rightUnassigned;
    }

    const leftStatus = normalizeLeadStatus(left.status);
    const rightStatus = normalizeLeadStatus(right.status);
    const leftIsNew = leftStatus === "new" ? 0 : 1;
    const rightIsNew = rightStatus === "new" ? 0 : 1;
    if (leftIsNew !== rightIsNew) {
      return leftIsNew - rightIsNew;
    }

    const leftPriority = normalizeLeadPriority(left.priority);
    const rightPriority = normalizeLeadPriority(right.priority);
    const byPriority = (prioritySortOrder[leftPriority] ?? 99) - (prioritySortOrder[rightPriority] ?? 99);
    if (byPriority !== 0) {
      return byPriority;
    }

    const byCreated = asTimestamp(left.createdAt) - asTimestamp(right.createdAt);
    if (byCreated !== 0) {
      return byCreated;
    }

    return String(left.id || "").localeCompare(String(right.id || ""), "ru");
  });
  return queue;
}

function getOperationalQueue() {
  return sortOperationalQueue(allLeads.filter((lead) => isOperationalLead(lead)));
}

function setTakeNextButtonsState(enabled, labelText) {
  const label = String(labelText || "Взять следующую");

  if (takeNextLead) {
    takeNextLead.disabled = !enabled;
    takeNextLead.textContent = label;
  }

  if (takeNextLeadFab) {
    takeNextLeadFab.disabled = !enabled;
    takeNextLeadFab.textContent = label;
    takeNextLeadFab.hidden = !enabled;
  }
}

function refreshOperationalPanel() {
  const queue = getOperationalQueue();
  const nextLead = queue[0] || null;
  const canOperate = Boolean(actor?.id && canAssignLeads());
  const hasPending = pendingLeadIds.size > 0;
  const isEnabled = canOperate && !hasPending && Boolean(nextLead);

  if (leadsOps) {
    leadsOps.hidden = false;
  }

  if (leadsOpsHint) {
    if (!queue.length) {
      leadsOpsHint.textContent = "Очередь пуста. Новых и неназначенных заявок нет.";
    } else {
      const nextName = leadDisplayName(nextLead);
      const nextPriority = priorityLabels[normalizeLeadPriority(nextLead.priority)] || "Обычный";
      leadsOpsHint.textContent = `В очереди ${formatNumber(queue.length)}. Следующая: ${nextName} (${nextPriority}).`;
    }
  }

  if (leadsOpsStatus) {
    if (!canOperate) {
      leadsOpsStatus.textContent = "Доступно только руководителю или владельцу.";
    } else if (hasPending) {
      leadsOpsStatus.textContent = "Подождите завершения текущего сохранения.";
    } else if (!queue.length) {
      leadsOpsStatus.textContent = "Очередь обработана.";
    } else {
      leadsOpsStatus.textContent = "";
    }
  }

  setTakeNextButtonsState(isEnabled, "Взять следующую");
}

function replaceLeadInList(nextLead) {
  if (!nextLead || !nextLead.id) {
    return;
  }
  const index = allLeads.findIndex((item) => String(item?.id || "") === String(nextLead.id));
  if (index >= 0) {
    allLeads[index] = nextLead;
  }
}

async function applyLeadPatch(lead, patch, successMessage, fallbackErrorMessage) {
  if (!lead || !lead.id) {
    setText(leadsStatus, "Заявка не найдена.", "var(--tone-error)");
    return false;
  }

  if (!patch || Object.keys(patch).length === 0) {
    setText(leadsStatus, "Изменений нет.", "var(--tone-info)");
    return false;
  }

  if (pendingLeadIds.has(lead.id)) {
    return false;
  }

  pendingLeadIds.add(lead.id);
  renderLeads();
  updateCounterStatus();
  refreshOperationalPanel();

  let ok = false;
  try {
    const payload = await apiRequest(`/api/admin/leads/${encodeURIComponent(lead.id)}`, {
      method: "PATCH",
      body: patch
    });

    if (payload && payload.lead) {
      Object.assign(lead, payload.lead);
      replaceLeadInList(payload.lead);
    }

    setText(leadsStatus, successMessage || `Заявка обновлена: ${leadDisplayName(lead)}.`, "var(--tone-ok)");
    ok = true;
  } catch (error) {
    handleApiError(error, fallbackErrorMessage || "Не удалось сохранить изменения.");
  } finally {
    pendingLeadIds.delete(lead.id);
    refreshFilterOptions();
    renderSummary();
    renderLeads();
    updateCounterStatus();
    refreshOperationalPanel();
  }

  return ok;
}

function getLeadComments(lead) {
  const comments = Array.isArray(lead?.comments) ? [...lead.comments] : [];
  comments.sort((left, right) => asTimestamp(left.createdAt) - asTimestamp(right.createdAt));
  return comments;
}

function getLeadImportantEvents(lead) {
  const events = Array.isArray(lead?.importantEvents) ? [...lead.importantEvents] : [];
  events.sort((left, right) => {
    const leftDate = String(left?.nextOccurrence || "9999-12-31");
    const rightDate = String(right?.nextOccurrence || "9999-12-31");
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    return String(left?.createdAt || "").localeCompare(String(right?.createdAt || ""));
  });
  return events;
}

function formatLeadEventBadge(event) {
  if (!event) {
    return "Событие";
  }

  const title = String(event.title || "Событие").trim();
  const datePart = event.nextOccurrence ? formatDate(event.nextOccurrence) : "дата не указана";
  return `${title}: ${datePart}`;
}

async function addLeadComment(lead, text) {
  const message = String(text || "").trim();
  if (!message) {
    setText(leadsStatus, "Введите текст комментария.", "var(--tone-error)");
    return false;
  }

  setFocusedLead(lead.id, false);

  if (pendingLeadIds.has(lead.id)) {
    return false;
  }

  pendingLeadIds.add(lead.id);
  renderLeads();
  updateCounterStatus();
  refreshOperationalPanel();

  let ok = false;
  try {
    const payload = await apiRequest(`/api/admin/leads/${encodeURIComponent(lead.id)}/comments`, {
      method: "POST",
      body: { text: message }
    });

    if (payload && payload.lead) {
      Object.assign(lead, payload.lead);
      replaceLeadInList(payload.lead);
    }

    setText(leadsStatus, `Комментарий добавлен: ${leadDisplayName(lead)}.`, "var(--tone-ok)");
    ok = true;
  } catch (error) {
    handleApiError(error, "Не удалось добавить комментарий.");
  } finally {
    pendingLeadIds.delete(lead.id);
    refreshFilterOptions();
    renderSummary();
    renderLeads();
    updateCounterStatus();
    refreshOperationalPanel();
  }

  return ok;
}

async function handleTakeNextLead() {
  if (!actor?.id || !canAssignLeads()) {
    setText(leadsStatus, "Операционный режим доступен руководителю или владельцу.", "var(--tone-error)");
    refreshOperationalPanel();
    return;
  }

  const queue = getOperationalQueue().filter((lead) => !pendingLeadIds.has(lead.id));
  const nextLead = queue[0];

  if (!nextLead) {
    setText(leadsStatus, "Очередь пуста.", "var(--tone-info)");
    refreshOperationalPanel();
    return;
  }

  const patch = {};
  const status = normalizeLeadStatus(nextLead.status);
  if ((nextLead.assigneeId || "") !== actor.id) {
    patch.assigneeId = actor.id;
  }
  if (status === "new") {
    patch.status = "in_progress";
  }

  if (Object.keys(patch).length === 0) {
    setText(leadsStatus, `Следующая заявка уже у вас: ${leadDisplayName(nextLead)}.`, "var(--tone-info)");
    refreshOperationalPanel();
    return;
  }

  const successMessage = `Взята в работу: ${leadDisplayName(nextLead)}.`;
  await applyLeadPatch(nextLead, patch, successMessage, "Не удалось взять следующую заявку.");
}

function createLeadField(label, value) {
  const row = document.createElement("p");
  const strong = document.createElement("strong");
  strong.textContent = `${label}:`;
  row.append(strong, ` ${value}`);
  return row;
}

function createLeadTag(text, className) {
  const tag = document.createElement("span");
  tag.className = `lead-tag ${className || ""}`.trim();
  tag.textContent = text;
  return tag;
}

function getAssignableUsers(department) {
  const users = collectAssignees();
  if (!department || department === "unassigned") {
    return users;
  }
  return users.filter((user) => (user.department || "unassigned") === department);
}

function fillAssigneeSelect(select, department, selectedId, selectedName) {
  if (!select) {
    return;
  }

  const users = getAssignableUsers(department);
  select.innerHTML = "";
  select.appendChild(buildSelectOption("", "Не назначено"));
  users.forEach((user) => {
    select.appendChild(buildSelectOption(user.id, user.name));
  });

  if (
    selectedId &&
    !Array.from(select.options).some((option) => option.value === selectedId)
  ) {
    select.appendChild(buildSelectOption(selectedId, selectedName || selectedId));
  }

  select.value = selectedId || "";
}

function buildEditorControl(labelText, control, hintText) {
  const wrapper = document.createElement("label");
  wrapper.className = "lead-editor__control";

  const label = document.createElement("span");
  label.textContent = labelText;
  wrapper.appendChild(label);
  wrapper.appendChild(control);

  if (hintText) {
    const hint = document.createElement("small");
    hint.className = "lead-editor__hint";
    hint.textContent = hintText;
    wrapper.appendChild(hint);
  }

  return wrapper;
}

function createSummaryCard(flowKey, label, value, hint) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lead-summary";
  if (flowKey === activeFlow) {
    button.classList.add("is-active");
  }

  const valueNode = document.createElement("strong");
  valueNode.className = "lead-summary__value";
  valueNode.textContent = formatNumber(value);

  const labelNode = document.createElement("span");
  labelNode.className = "lead-summary__label";
  labelNode.textContent = label;

  const hintNode = document.createElement("small");
  hintNode.className = "lead-summary__hint";
  hintNode.textContent = hint;

  button.append(valueNode, labelNode, hintNode);
  button.addEventListener("click", () => {
    setActiveFlow(flowKey);
  });

  return button;
}

function renderSummary() {
  if (!leadsSummary) {
    return;
  }

  const counts = {
    all: allLeads.length,
    new: 0,
    in_progress: 0,
    done: 0,
    unassigned: 0
  };

  allLeads.forEach((lead) => {
    const status = normalizeLeadStatus(lead.status);
    counts[status] = (counts[status] || 0) + 1;
    if (!lead.assigneeId) {
      counts.unassigned += 1;
    }
  });

  leadsSummary.innerHTML = "";
  leadsSummary.append(
    createSummaryCard("all", "Все заявки", counts.all, "Полный список"),
    createSummaryCard("new", "Новые", counts.new, "Требуют разбора"),
    createSummaryCard("in_progress", "В работе", counts.in_progress, "Текущие задачи"),
    createSummaryCard("unassigned", "Без исполнителя", counts.unassigned, "Нужно назначить"),
    createSummaryCard("done", "Завершенные", counts.done, "Готово")
  );
}

function setActiveFlow(nextFlow) {
  const normalized = Object.prototype.hasOwnProperty.call(flowLabels, nextFlow) ? nextFlow : "all";
  if (activeFlow === normalized) {
    return;
  }
  activeFlow = normalized;
  syncFilterState();
  renderSummary();
  handleFilterChange();
}

function createStageSection(stageKey, title, hint, leads) {
  const section = document.createElement("section");
  section.className = `lead-stage lead-stage--${stageKey}`;

  const head = document.createElement("header");
  head.className = "lead-stage__head";

  const titleNode = document.createElement("h3");
  titleNode.className = "lead-stage__title";
  titleNode.textContent = title;

  const meta = document.createElement("p");
  meta.className = "lead-stage__meta";
  meta.textContent = `${formatNumber(leads.length)} заявок`;

  head.append(titleNode, meta);

  section.appendChild(head);
  if (hint) {
    const hintNode = document.createElement("p");
    hintNode.className = "lead-stage__hint";
    hintNode.textContent = hint;
    section.appendChild(hintNode);
  }

  const list = document.createElement("div");
  list.className = "lead-stage__list";

  if (!leads.length) {
    const empty = document.createElement("p");
    empty.className = "lead-stage__empty";
    empty.textContent = "Заявок в этой секции нет.";
    list.appendChild(empty);
  } else {
    leads.forEach((lead) => {
      list.appendChild(createLeadCard(lead));
    });
  }

  section.appendChild(list);
  return section;
}

function buildLeadSections(leads) {
  if (activeFlow === "all") {
    return [
      {
        key: "new",
        title: "Новые",
        hint: flowHints.new,
        leads: leads.filter((lead) => normalizeLeadStatus(lead.status) === "new")
      },
      {
        key: "in_progress",
        title: "В работе",
        hint: flowHints.in_progress,
        leads: leads.filter((lead) => normalizeLeadStatus(lead.status) === "in_progress")
      },
      {
        key: "done",
        title: "Завершенные",
        hint: flowHints.done,
        leads: leads.filter((lead) => normalizeLeadStatus(lead.status) === "done")
      }
    ];
  }

  if (activeFlow === "unassigned") {
    return [
      {
        key: "unassigned",
        title: "Без исполнителя",
        hint: flowHints.unassigned,
        leads
      }
    ];
  }

  return [
    {
      key: activeFlow,
      title: flowLabels[activeFlow] || "Заявки",
      hint: flowHints[activeFlow] || "",
      leads
    }
  ];
}

function createLeadCard(lead) {
  const leadStatus = normalizeLeadStatus(lead.status);
  const leadPriority = normalizeLeadPriority(lead.priority);
  const isFocusedLead = Boolean(focusedLeadId && String(lead.id) === String(focusedLeadId));

  const item = document.createElement("article");
  item.className = "lead-item";
  item.dataset.leadId = lead.id || "";
  if (pendingLeadIds.has(lead.id)) {
    item.classList.add("is-saving");
  }
  if (isFocusedLead) {
    item.classList.add("lead-item--focused");
  }

  const meta = document.createElement("div");
  meta.className = "lead-meta";

  const title = document.createElement("h3");
  title.textContent = lead.name || "Без имени";

  const created = document.createElement("p");
  created.textContent = `Создано: ${formatDate(lead.createdAt)}`;

  meta.append(title, created);

  const tags = document.createElement("div");
  tags.className = "lead-tags";
  tags.appendChild(
    createLeadTag(statusLabels[leadStatus] || "Новая", `lead-tag--status-${leadStatus}`)
  );
  tags.appendChild(
    createLeadTag(priorityLabels[leadPriority] || "Обычный", `lead-tag--priority-${leadPriority}`)
  );
  tags.appendChild(createLeadTag(prettifyDepartment(lead.department), "lead-tag--department"));
  tags.appendChild(
    createLeadTag(lead.assigneeName ? `Исп.: ${lead.assigneeName}` : "Не назначено", "lead-tag--assignee")
  );

  const isReadOnlyViewer = !actor || !actor.id;
  const canAssign = !isReadOnlyViewer && canAssignLeads();
  const isHelpOnlyRole = !isReadOnlyViewer && (actor?.role === "worker" || actor?.role === "help");
  const canEditStatus = !isReadOnlyViewer && (!isHelpOnlyRole || lead.assigneeId === actor?.id);
  const canEditNote = !isReadOnlyViewer && (!isHelpOnlyRole || lead.assigneeId === actor?.id);
  const canComment = !isReadOnlyViewer;

  const quickActions = document.createElement("div");
  quickActions.className = "lead-quick-actions";

  const openCrmButton = document.createElement("button");
  openCrmButton.className = "btn btn--ghost lead-quick-actions__btn";
  openCrmButton.type = "button";
  openCrmButton.textContent = "Карточка CRM";
  quickActions.appendChild(openCrmButton);

  const transition = quickStatusTransitions[leadStatus];
  let quickStatusButton = null;
  if (canEditStatus && transition && transition.status !== leadStatus) {
    quickStatusButton = document.createElement("button");
    quickStatusButton.className = "btn btn--ghost lead-quick-actions__btn";
    quickStatusButton.type = "button";
    quickStatusButton.textContent = transition.label;
    quickActions.appendChild(quickStatusButton);
  }

  if (canAssign && !lead.assigneeId) {
    const hint = document.createElement("p");
    hint.className = "lead-quick-actions__hint";
    hint.textContent = "Заявка без исполнителя. Назначьте ответственного в редактировании.";
    quickActions.appendChild(hint);
  }

  const detailsBlock = document.createElement("div");
  detailsBlock.className = "lead-details";
  detailsBlock.appendChild(createLeadField("Контакт", lead.contact || "Не указан"));
  detailsBlock.appendChild(createLeadField("Тип", lead.type || "Не указан"));
  detailsBlock.appendChild(createLeadField("Источник", lead.sourcePage || "contact.html"));
  detailsBlock.appendChild(createLeadField("Описание", lead.message || "Без описания"));

  const crmPanel = document.createElement("details");
  crmPanel.className = "lead-crm-panel";
  crmPanel.open = isFocusedLead;

  const crmSummary = document.createElement("summary");
  crmSummary.textContent = "Карточка CRM и комментарии";
  crmPanel.appendChild(crmSummary);

  const crmBody = document.createElement("div");
  crmBody.className = "lead-crm";
  crmBody.appendChild(createLeadField("ID заявки", lead.id || "—"));
  crmBody.appendChild(createLeadField("Клиент", lead.name || "Без имени"));
  crmBody.appendChild(createLeadField("Контакт", lead.contact || "Не указан"));
  crmBody.appendChild(createLeadField("Создано", formatDate(lead.createdAt)));
  crmBody.appendChild(createLeadField("Обновлено", lead.updatedAt ? formatDate(lead.updatedAt) : "—"));

  const importantEvents = getLeadImportantEvents(lead);
  const eventsBlock = document.createElement("div");
  eventsBlock.className = "lead-crm-events";
  const eventsTitle = document.createElement("p");
  eventsTitle.className = "lead-crm-events__title";
  eventsTitle.textContent = "Важные события клиента";
  eventsBlock.appendChild(eventsTitle);
  if (importantEvents.length === 0) {
    const emptyEvents = document.createElement("p");
    emptyEvents.className = "lead-crm-events__empty";
    emptyEvents.textContent = "События не распознаны.";
    eventsBlock.appendChild(emptyEvents);
  } else {
    const eventsListNode = document.createElement("div");
    eventsListNode.className = "lead-crm-events__list";
    importantEvents.forEach((event) => {
      const badge = document.createElement("span");
      badge.className = "lead-crm-event";
      badge.textContent = formatLeadEventBadge(event);
      eventsListNode.appendChild(badge);
    });
    eventsBlock.appendChild(eventsListNode);
  }
  crmBody.appendChild(eventsBlock);

  const commentsBlock = document.createElement("section");
  commentsBlock.className = "lead-comments";
  const commentsTitle = document.createElement("h4");
  commentsTitle.textContent = "Комментарии сотрудников";
  commentsBlock.appendChild(commentsTitle);

  const commentsListNode = document.createElement("div");
  commentsListNode.className = "lead-comments__list";
  const comments = getLeadComments(lead);
  if (comments.length === 0) {
    const emptyComments = document.createElement("p");
    emptyComments.className = "lead-comments__empty";
    emptyComments.textContent = "Комментариев пока нет.";
    commentsListNode.appendChild(emptyComments);
  } else {
    comments.forEach((comment) => {
      const commentItem = document.createElement("article");
      commentItem.className = "lead-comment";

      const commentMeta = document.createElement("p");
      commentMeta.className = "lead-comment__meta";
      const author = String(comment.authorName || comment.authorId || "Сотрудник").trim();
      commentMeta.textContent = `${author} • ${formatDate(comment.createdAt)}`;

      const commentText = document.createElement("p");
      commentText.className = "lead-comment__text";
      commentText.textContent = comment.text || "";

      commentItem.append(commentMeta, commentText);
      commentsListNode.appendChild(commentItem);
    });
  }
  commentsBlock.appendChild(commentsListNode);

  const commentComposer = document.createElement("div");
  commentComposer.className = "lead-comments__composer";
  const commentInput = document.createElement("textarea");
  commentInput.rows = 2;
  commentInput.placeholder = "Комментарий по этой заявке";
  const commentButton = document.createElement("button");
  commentButton.className = "btn btn--ghost";
  commentButton.type = "button";
  commentButton.textContent = "Добавить комментарий";
  commentComposer.append(commentInput, commentButton);
  commentsBlock.appendChild(commentComposer);

  crmBody.appendChild(commentsBlock);
  crmPanel.appendChild(crmBody);

  const editor = document.createElement("div");
  editor.className = "lead-editor";

  const grid = document.createElement("div");
  grid.className = "lead-editor__grid";

  const statusSelect = document.createElement("select");
  Object.entries(statusLabels).forEach(([value, label]) => {
    statusSelect.appendChild(buildSelectOption(value, label));
  });
  statusSelect.value = leadStatus;
  grid.appendChild(
    buildEditorControl("Статус", statusSelect, canEditStatus ? "" : "Изменение недоступно")
  );

  const prioritySelect = document.createElement("select");
  Object.entries(priorityLabels).forEach(([value, label]) => {
    prioritySelect.appendChild(buildSelectOption(value, label));
  });
  prioritySelect.value = leadPriority;
  grid.appendChild(
    buildEditorControl("Приоритет", prioritySelect, canAssign ? "" : "Доступно руководителю")
  );

  const departmentSelect = document.createElement("select");
  collectDepartments().forEach((department) => {
    departmentSelect.appendChild(
      buildSelectOption(department, prettifyDepartment(department))
    );
  });
  if (!Array.from(departmentSelect.options).some((option) => option.value === lead.department)) {
    departmentSelect.appendChild(buildSelectOption(lead.department || "unassigned", prettifyDepartment(lead.department)));
  }
  departmentSelect.value = lead.department || "unassigned";
  grid.appendChild(
    buildEditorControl("Отдел", departmentSelect, canAssign ? "" : "Доступно руководителю")
  );

  const assigneeSelect = document.createElement("select");
  fillAssigneeSelect(
    assigneeSelect,
    departmentSelect.value,
    lead.assigneeId || "",
    lead.assigneeName || ""
  );
  grid.appendChild(
    buildEditorControl("Исполнитель", assigneeSelect, canAssign ? "" : "Доступно руководителю")
  );

  if (canAssign) {
    departmentSelect.addEventListener("change", () => {
      const currentSelection = assigneeSelect.value;
      fillAssigneeSelect(assigneeSelect, departmentSelect.value, currentSelection, lead.assigneeName || "");
    });
  }

  editor.appendChild(grid);

  const note = document.createElement("textarea");
  note.rows = 3;
  note.placeholder = "Внутренняя заметка по задаче";
  note.value = lead.internalNote || "";
  editor.appendChild(
    buildEditorControl("Задача и комментарии", note, canEditNote ? "" : "Изменение недоступно")
  );

  const actions = document.createElement("div");
  actions.className = "lead-editor__actions";

  const saveButton = document.createElement("button");
  saveButton.className = "btn btn--primary";
  saveButton.type = "button";
  saveButton.textContent = "Сохранить";

  const updated = document.createElement("p");
  updated.className = "lead-editor__updated";
  updated.textContent = lead.updatedAt ? `Обновлено: ${formatDate(lead.updatedAt)}` : "";
  actions.append(saveButton, updated);
  editor.appendChild(actions);

  const editorPanel = document.createElement("details");
  editorPanel.className = "lead-editor-panel";
  editorPanel.open = isFocusedLead || (leadStatus === "new" && !lead.assigneeId);

  const editorSummary = document.createElement("summary");
  editorSummary.textContent = "Подробное редактирование";
  editorPanel.append(editorSummary, editor);

  const hasAnyEditRights = canEditStatus || canAssign || canEditNote;
  function syncControls() {
    const isPending = pendingLeadIds.has(lead.id);
    item.classList.toggle("is-saving", isPending);
    statusSelect.disabled = !canEditStatus || isPending;
    prioritySelect.disabled = !canAssign || isPending;
    departmentSelect.disabled = !canAssign || isPending;
    assigneeSelect.disabled = !canAssign || isPending;
    note.disabled = !canEditNote || isPending;
    commentInput.disabled = !canComment || isPending;
    commentButton.disabled = !canComment || isPending;
    openCrmButton.disabled = isPending;
    saveButton.disabled = !hasAnyEditRights || isPending;
    if (quickStatusButton) {
      quickStatusButton.disabled = !canEditStatus || isPending;
    }
  }

  async function applyPatch(patch, successMessage, fallbackErrorMessage) {
    syncControls();
    await applyLeadPatch(lead, patch, successMessage, fallbackErrorMessage);
  }

  openCrmButton.addEventListener("click", () => {
    const isSame = String(focusedLeadId || "") === String(lead.id || "");
    setFocusedLead(lead.id, !isSame);
    if (isSame) {
      crmPanel.open = true;
    } else {
      renderLeads();
      updateCounterStatus();
      refreshOperationalPanel();
    }
  });

  if (quickStatusButton) {
    quickStatusButton.addEventListener("click", () => {
      const nextStatus = transition.status;
      if (!nextStatus || nextStatus === normalizeLeadStatus(lead.status)) {
        return;
      }
      applyPatch(
        { status: nextStatus },
        `Статус обновлен: ${statusLabels[nextStatus] || nextStatus}.`,
        "Не удалось обновить статус."
      );
    });
  }

  saveButton.addEventListener("click", () => {
    const patch = {};
    const nextStatus = statusSelect.value;
    const nextPriority = prioritySelect.value;
    const nextDepartment = departmentSelect.value || "unassigned";
    const nextAssigneeId = assigneeSelect.value || "";
    const nextNote = note.value.trim();

    if (canEditStatus && nextStatus !== normalizeLeadStatus(lead.status)) {
      patch.status = nextStatus;
    }
    if (canAssign && nextPriority !== normalizeLeadPriority(lead.priority)) {
      patch.priority = nextPriority;
    }
    if (canAssign && nextDepartment !== (lead.department || "unassigned")) {
      patch.department = nextDepartment;
    }
    if (canAssign && nextAssigneeId !== (lead.assigneeId || "")) {
      patch.assigneeId = nextAssigneeId;
    }
    if (canEditNote && nextNote !== (lead.internalNote || "")) {
      patch.internalNote = nextNote;
    }

    applyPatch(
      patch,
      `Заявка обновлена: ${lead.name || lead.id}.`,
      "Не удалось сохранить изменения."
    );
  });

  commentButton.addEventListener("click", async () => {
    const text = commentInput.value.trim();
    if (!text) {
      setText(leadsStatus, "Введите текст комментария.", "var(--tone-error)");
      return;
    }

    const added = await addLeadComment(lead, text);
    if (added) {
      commentInput.value = "";
    }
  });

  syncControls();

  item.append(meta, tags);
  if (quickActions.childElementCount > 0) {
    item.appendChild(quickActions);
  }
  item.append(detailsBlock, crmPanel, editorPanel);
  return item;
}

function updateCounterStatus() {
  if (!leadsStatus) {
    return;
  }

  const shown = getFilteredLeads().length;
  if (allLeads.length === 0) {
    setText(leadsStatus, "Заявок пока нет.", "var(--tone-info)");
    return;
  }

  const hasExtraFilters =
    Boolean(normalizeForSearch(leadSearch?.value || "")) ||
    Boolean(String(leadDepartmentFilter?.value || "")) ||
    Boolean(String(leadAssigneeFilter?.value || ""));

  if (!hasExtraFilters && activeFlow === "all") {
    const queueTotal = getOperationalQueue().length;
    setText(
      leadsStatus,
      `Всего заявок: ${formatNumber(allLeads.length)}. В очереди: ${formatNumber(queueTotal)}.`,
      "var(--tone-info)"
    );
    return;
  }

  const flowName = flowLabels[activeFlow] || flowLabels.all;
  const sortName = sortLabels[String(leadSortMode?.value || "queue")] || sortLabels.queue;
  setText(
    leadsStatus,
    `Поток: ${flowName}. Показано ${formatNumber(shown)} из ${formatNumber(allLeads.length)} (сортировка по ${sortName}).`,
    "var(--tone-info)"
  );
}

function renderLeads() {
  if (!leadsList) {
    return;
  }

  const filteredLeads = sortLeads(getFilteredLeads());
  leadsList.innerHTML = "";

  if (filteredLeads.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent =
      allLeads.length > 0 ? "По выбранным условиям заявок нет." : "Заявок пока нет.";
    leadsList.appendChild(empty);
    return;
  }

  const sections = buildLeadSections(filteredLeads);
  sections.forEach((section) => {
    leadsList.appendChild(createStageSection(section.key, section.title, section.hint, section.leads));
  });

  scrollToFocusedLeadIfNeeded();
}

async function loadLeadsData() {
  if (refreshLeads) {
    refreshLeads.disabled = true;
  }
  setText(leadsStatus, "Загрузка заявок...", "var(--tone-warn)");

  try {
    const [teamPayload, leadsPayload] = await Promise.all([
      apiRequest("/api/admin/team"),
      apiRequest("/api/admin/leads?limit=5000")
    ]);

    actor = teamPayload.actor || leadsPayload.actor || actor;
    permissions = teamPayload.permissions || leadsPayload.permissions || {};
    teamUsers = Array.isArray(teamPayload.users) ? teamPayload.users : [];
    visibleDepartments = Array.isArray(teamPayload.departments) ? teamPayload.departments : [];
    allLeads = Array.isArray(leadsPayload.leads) ? leadsPayload.leads : [];

    setAuthRequiredState(false);
    setOwnerAdminVisible(actor?.role === "owner");
    refreshActorMeta();
    refreshFilterOptions();
    renderSummary();
    renderLeads();
    updateCounterStatus();
    refreshOperationalPanel();
  } catch (error) {
    handleApiError(error, "Не удалось загрузить заявки.");
  } finally {
    refreshOperationalPanel();
    if (refreshLeads) {
      refreshLeads.disabled = false;
    }
  }
}

function handleFilterChange() {
  renderLeads();
  updateCounterStatus();
  refreshOperationalPanel();
}

function resetFilters() {
  if (leadSearch) {
    leadSearch.value = "";
  }
  if (leadSortMode) {
    leadSortMode.value = "queue";
  }
  if (leadDepartmentFilter) {
    leadDepartmentFilter.value = "";
  }
  if (leadAssigneeFilter) {
    leadAssigneeFilter.value = "";
  }
  activeFlow = "all";
  syncFilterState();
  renderSummary();
  handleFilterChange();
}

if (!apiAllowed) {
  setAuthRequiredState(false);
  setOwnerAdminVisible(false);
  setText(leadsAuthStatus, "Откройте через сервер: http://localhost:3000/admin-leads.html", "var(--tone-error)");
  setText(leadsStatus, "Откройте через сервер: http://localhost:3000/admin-leads.html", "var(--tone-error)");
  refreshOperationalPanel();
} else {
  token = "";
  setAuthRequiredState(false);
  refreshOperationalPanel();
  loadLeadsData();

  if (refreshLeads) {
    refreshLeads.addEventListener("click", () => {
      loadLeadsData();
    });
  }

  if (leadSearch) {
    leadSearch.addEventListener("input", handleFilterChange);
  }
  if (leadSortMode) {
    leadSortMode.addEventListener("change", handleFilterChange);
  }
  if (leadDepartmentFilter) {
    leadDepartmentFilter.addEventListener("change", handleFilterChange);
  }
  if (leadAssigneeFilter) {
    leadAssigneeFilter.addEventListener("change", handleFilterChange);
  }
  if (resetLeadFilters) {
    resetLeadFilters.addEventListener("click", () => {
      resetFilters();
    });
  }

  if (takeNextLead) {
    takeNextLead.addEventListener("click", () => {
      handleTakeNextLead();
    });
  }

  if (takeNextLeadFab) {
    takeNextLeadFab.addEventListener("click", () => {
      handleTakeNextLead();
    });
  }
}

