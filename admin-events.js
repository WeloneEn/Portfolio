"use strict";

const eventsAuth = document.getElementById("eventsAuth");
const eventsAuthStatus = document.getElementById("eventsAuthStatus");
const eventsPanel = document.getElementById("eventsPanel");
const eventsActorMeta = document.getElementById("eventsActorMeta");
const eventsStatus = document.getElementById("eventsStatus");
const eventsSummary = document.getElementById("eventsSummary");
const refreshEvents = document.getElementById("refreshEvents");
const eventSearch = document.getElementById("eventSearch");
const eventScopeFilter = document.getElementById("eventScopeFilter");
const eventsList = document.getElementById("eventsList");

const apiAllowed = window.location.protocol === "http:" || window.location.protocol === "https:";

const roleLabels = {
  owner: "Владелец",
  help: "Help",
  manager: "Руководитель",
  worker: "Сотрудник"
};

const timelineLabels = {
  soon: "Скоро",
  upcoming: "План",
  overdue: "Просрочено",
  no_date: "Без даты"
};

let actor = null;
let permissions = {};
let allEvents = [];
let stats = {
  total: 0,
  overdue: 0,
  soon: 0,
  upcoming: 0,
  noDate: 0
};

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
  if (eventsAuth) {
    eventsAuth.hidden = !isRequired;
    eventsAuth.setAttribute("aria-hidden", String(!isRequired));
  }
  if (eventsPanel) {
    eventsPanel.hidden = isRequired;
    eventsPanel.setAttribute("aria-hidden", String(isRequired));
  }
}

function normalizeForSearch(value) {
  return String(value || "").toLowerCase().trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat("ru-RU").format(Number(value) || 0);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value || "—";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatDaysUntil(value) {
  if (!Number.isFinite(Number(value))) {
    return "без даты";
  }

  const days = Number(value);
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? "просрочено на 1 день" : `просрочено на ${overdue} дн.`;
  }
  if (days === 0) {
    return "сегодня";
  }
  if (days === 1) {
    return "через 1 день";
  }
  return `через ${days} дн.`;
}

function renderActorMeta() {
  if (!eventsActorMeta || !actor) {
    return;
  }

  const role = roleLabels[actor.role] || actor.role || "Сотрудник";
  const name = actor.name || actor.username || actor.id || "Пользователь";
  const scope = permissions.canViewAllLeads ? "видит все события" : "видит события своего контура";
  eventsActorMeta.textContent = `${name} • ${role} • ${scope}`;
}

function createSummaryButton(scope, label, value) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "event-summary";
  if ((eventScopeFilter?.value || "all") === scope) {
    button.classList.add("is-active");
  }

  const valueNode = document.createElement("strong");
  valueNode.className = "event-summary__value";
  valueNode.textContent = formatNumber(value);

  const labelNode = document.createElement("span");
  labelNode.className = "event-summary__label";
  labelNode.textContent = label;

  button.append(valueNode, labelNode);
  button.addEventListener("click", () => {
    if (!eventScopeFilter) {
      return;
    }
    eventScopeFilter.value = scope;
    loadEventsData();
  });

  return button;
}

function renderSummary() {
  if (!eventsSummary) {
    return;
  }

  eventsSummary.innerHTML = "";
  eventsSummary.append(
    createSummaryButton("all", "Все события", stats.total),
    createSummaryButton("soon", "В течение 7 дней", stats.soon),
    createSummaryButton("upcoming", "Ближайшие", stats.soon + stats.upcoming),
    createSummaryButton("overdue", "Просроченные", stats.overdue),
    createSummaryButton("no_date", "Без даты", stats.noDate)
  );
}

function getFilteredEvents() {
  const query = normalizeForSearch(eventSearch?.value || "");
  if (!query) {
    return allEvents;
  }

  return allEvents.filter((event) => {
    const lead = event.lead || {};
    const searchBlob = [
      event.title,
      event.type,
      event.sourceText,
      event.clientName,
      event.clientContact,
      lead.name,
      lead.contact
    ]
      .map((item) => normalizeForSearch(item))
      .join(" ");
    return searchBlob.includes(query);
  });
}

function createEventCard(event) {
  const card = document.createElement("article");
  card.className = `event-card event-card--${event.timeline || "upcoming"}`;

  const head = document.createElement("header");
  head.className = "event-card__head";

  const title = document.createElement("h3");
  title.textContent = event.title || "Важное событие";

  const timeline = document.createElement("span");
  timeline.className = `event-card__timeline event-card__timeline--${event.timeline || "upcoming"}`;
  timeline.textContent = timelineLabels[event.timeline] || "Событие";

  head.append(title, timeline);

  const meta = document.createElement("p");
  meta.className = "event-card__meta";
  if (event.nextOccurrence) {
    meta.textContent = `${formatDate(event.nextOccurrence)} • ${formatDaysUntil(event.daysUntil)}`;
  } else {
    meta.textContent = "Дата не указана";
  }

  const details = document.createElement("div");
  details.className = "event-card__details";

  const lead = event.lead || {};
  const clientName = event.clientName || lead.name || "Клиент без имени";
  const clientContact = event.clientContact || lead.contact || "Контакт не указан";
  const sourceText = event.sourceText || "Источник не указан";

  const makeLine = (label, value) => {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = `${label}:`;
    line.append(strong, ` ${value}`);
    return line;
  };

  const client = makeLine("Клиент", clientName);
  const contact = makeLine("Контакт", clientContact);
  const source = makeLine("Маркер", sourceText);

  details.append(client, contact, source);

  const actions = document.createElement("div");
  actions.className = "event-card__actions";

  const leadLink = document.createElement("a");
  leadLink.className = "btn btn--ghost";
  leadLink.href = lead && lead.id ? `admin-leads.html?lead=${encodeURIComponent(lead.id)}` : "admin-leads.html";
  leadLink.textContent = "Открыть заявку";
  actions.appendChild(leadLink);

  card.append(head, meta, details, actions);
  return card;
}

function renderEventsList() {
  if (!eventsList) {
    return;
  }

  const events = getFilteredEvents();
  eventsList.innerHTML = "";

  if (events.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-status";
    empty.textContent = "Событий по текущим фильтрам нет.";
    eventsList.appendChild(empty);
    return;
  }

  events.forEach((event) => {
    eventsList.appendChild(createEventCard(event));
  });
}

async function apiRequest(path) {
  const response = await fetch(resolveApiUrl(path), {
    method: "GET"
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
    setText(eventsStatus, "Backend недоступен. Проверьте WELONE_API_BASE в config.js и CORS на backend.", "var(--tone-error)");
    return;
  }

  if (error && (error.status === 404 || error.message === "HTTP_404")) {
    setText(eventsStatus, "API /api не найден (404). Нужен backend сервер.", "var(--tone-error)");
    return;
  }

  setText(eventsStatus, fallbackMessage, "var(--tone-error)");
}

async function loadEventsData() {
  if (refreshEvents) {
    refreshEvents.disabled = true;
  }

  setText(eventsStatus, "Загрузка событий...", "var(--tone-warn)");

  try {
    const scope = eventScopeFilter?.value || "all";
    const payload = await apiRequest(`/api/admin/events?limit=1000&scope=${encodeURIComponent(scope)}`);

    actor = payload.actor || actor;
    permissions = payload.permissions || {};
    allEvents = Array.isArray(payload.events) ? payload.events : [];
    stats = payload.stats || stats;

    setAuthState(false);
    renderActorMeta();
    renderSummary();
    renderEventsList();
    setText(eventsStatus, `Событий: ${formatNumber(payload.total || allEvents.length)}.`, "var(--tone-info)");
  } catch (error) {
    handleApiError(error, "Не удалось загрузить события.");
  } finally {
    if (refreshEvents) {
      refreshEvents.disabled = false;
    }
  }
}

function handleSearchChange() {
  renderEventsList();
  const shown = getFilteredEvents().length;
  setText(eventsStatus, `Показано событий: ${formatNumber(shown)} из ${formatNumber(allEvents.length)}.`, "var(--tone-info)");
}

if (!apiAllowed) {
  setAuthState(false);
  setText(eventsAuthStatus, "Откройте через сервер: http://localhost:3000/admin-events.html", "var(--tone-error)");
  setText(eventsStatus, "Откройте через сервер: http://localhost:3000/admin-events.html", "var(--tone-error)");
} else {
  setAuthState(false);
  loadEventsData();

  if (refreshEvents) {
    refreshEvents.addEventListener("click", () => {
      loadEventsData();
    });
  }
  if (eventScopeFilter) {
    eventScopeFilter.addEventListener("change", () => {
      loadEventsData();
    });
  }
  if (eventSearch) {
    eventSearch.addEventListener("input", handleSearchChange);
  }
}
