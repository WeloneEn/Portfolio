"use strict";

const authRequired = document.getElementById("authRequired");
const leadsAuthStatus = document.getElementById("leadsAuthStatus");
const leadsPanel = document.getElementById("leadsPanel");
const leadsActorMeta = document.getElementById("leadsActorMeta");
const leadsStatus = document.getElementById("leadsStatus");
const leadsList = document.getElementById("leadsList");
const refreshLeads = document.getElementById("refreshLeads");
const ownerAdminLink = document.getElementById("ownerAdminLink");
const leadsAdminNavLink = document.getElementById("leadsAdminNavLink");
const leadSearch = document.getElementById("leadSearch");
const leadStatusFilter = document.getElementById("leadStatusFilter");
const leadDepartmentFilter = document.getElementById("leadDepartmentFilter");
const leadAssigneeFilter = document.getElementById("leadAssigneeFilter");

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

const errorMessages = {
  FORBIDDEN: "Недостаточно прав для этой заявки.",
  FORBIDDEN_STATUS: "Недостаточно прав для смены статуса.",
  FORBIDDEN_PRIORITY: "Недостаточно прав для смены приоритета.",
  FORBIDDEN_NOTE: "Недостаточно прав для редактирования заметки.",
  FORBIDDEN_ASSIGNMENT: "Недостаточно прав для назначения.",
  FORBIDDEN_ASSIGNEE: "Нельзя назначить этого сотрудника.",
  FORBIDDEN_DEPARTMENT: "Нельзя назначить этот отдел.",
  ASSIGNEE_NOT_FOUND: "Сотрудник для назначения не найден.",
  LEAD_NOT_FOUND: "Заявка не найдена."
};

let token = "";
let actor = null;
let permissions = {};
let teamUsers = [];
let visibleDepartments = [];
let allLeads = [];
const pendingLeadIds = new Set();

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

function normalizeForSearch(value) {
  return String(value || "").toLowerCase().trim();
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

  if (error && error.status === 404 && error.message === "LEAD_NOT_FOUND") {
    setText(leadsStatus, errorMessages.LEAD_NOT_FOUND, "var(--tone-error)");
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
    leadAssigneeFilter.appendChild(buildSelectOption("__none__", "Без исполнителя"));

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
}

function getFilteredLeads() {
  const query = normalizeForSearch(leadSearch?.value || "");
  const statusFilterValue = String(leadStatusFilter?.value || "");
  const departmentFilterValue = String(leadDepartmentFilter?.value || "");
  const assigneeFilterValue = String(leadAssigneeFilter?.value || "");

  return allLeads.filter((lead) => {
    if (statusFilterValue && lead.status !== statusFilterValue) {
      return false;
    }
    if (departmentFilterValue && (lead.department || "unassigned") !== departmentFilterValue) {
      return false;
    }
    if (assigneeFilterValue === "__none__" && lead.assigneeId) {
      return false;
    }
    if (
      assigneeFilterValue &&
      assigneeFilterValue !== "__none__" &&
      (lead.assigneeId || "") !== assigneeFilterValue
    ) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchBlob = [
      lead.name,
      lead.contact,
      lead.type,
      lead.message,
      lead.sourcePage,
      lead.status,
      lead.priority,
      lead.department,
      lead.assigneeName,
      lead.internalNote
    ]
      .map((item) => normalizeForSearch(item))
      .join(" ");

    return searchBlob.includes(query);
  });
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

function createLeadCard(lead) {
  const item = document.createElement("article");
  item.className = "lead-item";
  if (pendingLeadIds.has(lead.id)) {
    item.classList.add("is-saving");
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
    createLeadTag(statusLabels[lead.status] || "Новая", `lead-tag--status-${lead.status || "new"}`)
  );
  tags.appendChild(
    createLeadTag(priorityLabels[lead.priority] || "Обычный", `lead-tag--priority-${lead.priority || "normal"}`)
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

  const details = document.createElement("div");
  details.className = "lead-details";
  details.appendChild(createLeadField("Контакт", lead.contact || "Не указан"));
  details.appendChild(createLeadField("Тип", lead.type || "Не указан"));
  details.appendChild(createLeadField("Источник", lead.sourcePage || "contact.html"));
  details.appendChild(createLeadField("Описание", lead.message || "Без описания"));

  const editor = document.createElement("div");
  editor.className = "lead-editor";

  const grid = document.createElement("div");
  grid.className = "lead-editor__grid";

  const statusSelect = document.createElement("select");
  Object.entries(statusLabels).forEach(([value, label]) => {
    statusSelect.appendChild(buildSelectOption(value, label));
  });
  statusSelect.value = lead.status || "new";
  statusSelect.disabled = !canEditStatus || pendingLeadIds.has(lead.id);
  grid.appendChild(
    buildEditorControl("Статус", statusSelect, canEditStatus ? "" : "Изменение недоступно")
  );

  const prioritySelect = document.createElement("select");
  Object.entries(priorityLabels).forEach(([value, label]) => {
    prioritySelect.appendChild(buildSelectOption(value, label));
  });
  prioritySelect.value = lead.priority || "normal";
  prioritySelect.disabled = !canAssign || pendingLeadIds.has(lead.id);
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
  departmentSelect.disabled = !canAssign || pendingLeadIds.has(lead.id);
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
  assigneeSelect.disabled = !canAssign || pendingLeadIds.has(lead.id);
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
  note.disabled = !canEditNote || pendingLeadIds.has(lead.id);
  editor.appendChild(
    buildEditorControl("Задача и комментарии", note, canEditNote ? "" : "Изменение недоступно")
  );

  const actions = document.createElement("div");
  actions.className = "lead-editor__actions";

  const saveButton = document.createElement("button");
  saveButton.className = "btn btn--primary";
  saveButton.type = "button";
  saveButton.textContent = "Сохранить";

  const hasAnyEditRights = canEditStatus || canAssign || canEditNote;
  saveButton.disabled = !hasAnyEditRights || pendingLeadIds.has(lead.id);

  const updated = document.createElement("p");
  updated.className = "lead-editor__updated";
  updated.textContent = lead.updatedAt ? `Обновлено: ${formatDate(lead.updatedAt)}` : "";
  actions.append(saveButton, updated);
  editor.appendChild(actions);

  saveButton.addEventListener("click", async () => {
    if (pendingLeadIds.has(lead.id)) {
      return;
    }

    const patch = {};
    const nextStatus = statusSelect.value;
    const nextPriority = prioritySelect.value;
    const nextDepartment = departmentSelect.value || "unassigned";
    const nextAssigneeId = assigneeSelect.value || "";
    const nextNote = note.value.trim();

    if (canEditStatus && nextStatus !== (lead.status || "new")) {
      patch.status = nextStatus;
    }
    if (canAssign && nextPriority !== (lead.priority || "normal")) {
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

    if (Object.keys(patch).length === 0) {
      setText(leadsStatus, "Изменений нет.", "var(--tone-info)");
      return;
    }

    let updatedSuccessfully = false;
    pendingLeadIds.add(lead.id);
    item.classList.add("is-saving");
    saveButton.disabled = true;

    try {
      const payload = await apiRequest(`/api/admin/leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        body: patch
      });

      if (payload && payload.lead) {
        Object.assign(lead, payload.lead);
      }
      updatedSuccessfully = true;
    } catch (error) {
      handleApiError(error, "Не удалось сохранить изменения.");
    } finally {
      pendingLeadIds.delete(lead.id);
      if (updatedSuccessfully) {
        refreshFilterOptions();
        renderLeads();
        setText(leadsStatus, `Заявка обновлена: ${lead.name || lead.id}.`, "var(--tone-ok)");
      } else {
        item.classList.remove("is-saving");
        saveButton.disabled = false;
      }
    }
  });

  item.append(meta, tags, details, editor);
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

  if (shown === allLeads.length) {
    setText(leadsStatus, `Всего заявок: ${formatNumber(allLeads.length)}.`, "var(--tone-info)");
    return;
  }

  setText(
    leadsStatus,
    `Показано заявок: ${formatNumber(shown)} из ${formatNumber(allLeads.length)}.`,
    "var(--tone-info)"
  );
}

function renderLeads() {
  if (!leadsList) {
    return;
  }

  const filteredLeads = getFilteredLeads();
  leadsList.innerHTML = "";

  if (filteredLeads.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent =
      allLeads.length > 0 ? "По выбранным фильтрам заявок нет." : "Заявок пока нет.";
    leadsList.appendChild(empty);
    return;
  }

  filteredLeads.forEach((lead) => {
    leadsList.appendChild(createLeadCard(lead));
  });
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
    renderLeads();
    updateCounterStatus();
  } catch (error) {
    handleApiError(error, "Не удалось загрузить заявки.");
  } finally {
    if (refreshLeads) {
      refreshLeads.disabled = false;
    }
  }
}

function handleFilterChange() {
  renderLeads();
  updateCounterStatus();
}

if (!apiAllowed) {
  setAuthRequiredState(false);
  setOwnerAdminVisible(false);
  setText(leadsAuthStatus, "Откройте через сервер: http://localhost:3000/admin-leads.html", "var(--tone-error)");
  setText(leadsStatus, "Откройте через сервер: http://localhost:3000/admin-leads.html", "var(--tone-error)");
} else {
  token = "";
  setAuthRequiredState(false);
  loadLeadsData();

  if (refreshLeads) {
    refreshLeads.addEventListener("click", () => {
      loadLeadsData();
    });
  }

  if (leadSearch) {
    leadSearch.addEventListener("input", handleFilterChange);
  }
  if (leadStatusFilter) {
    leadStatusFilter.addEventListener("change", handleFilterChange);
  }
  if (leadDepartmentFilter) {
    leadDepartmentFilter.addEventListener("change", handleFilterChange);
  }
  if (leadAssigneeFilter) {
    leadAssigneeFilter.addEventListener("change", handleFilterChange);
  }
}

