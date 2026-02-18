const preloader = document.getElementById("preloader");
const cursorGlow = document.getElementById("cursorGlow");
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const brandTrigger = document.getElementById("brandTrigger");
const adminHotspot = document.getElementById("adminHotspot");
const leadsNavLink = document.getElementById("leadsNavLink");
const adminNavLink = document.getElementById("adminNavLink");
const themeToggle = document.getElementById("themeToggle");

const API_IS_AVAILABLE = window.location.protocol === "http:" || window.location.protocol === "https:";
const META_API_BASE_SELECTOR = 'meta[name="welone-api-base"]';

function resolveApiBase() {
  const meta = document.querySelector(META_API_BASE_SELECTOR);
  const metaValue = meta ? String(meta.getAttribute("content") || "").trim() : "";
  const globalValue = typeof window.WELONE_API_BASE === "string" ? window.WELONE_API_BASE.trim() : "";

  let base = metaValue || globalValue || window.location.origin;
  base = String(base || "").trim().replace(/\/+$/g, "");
  if (base.toLowerCase().endsWith("/api")) {
    base = base.slice(0, -4);
  }

  return `${base}/`;
}

const API_BASE = resolveApiBase();

function apiUrl(pathname) {
  const rel = String(pathname || "").trim().replace(/^\/+/, "");
  return new URL(rel, API_BASE).toString();
}

// Expose API helper for admin scripts (admin.js/admin-leads.js).
window.WELONE_API = window.WELONE_API || {};
window.WELONE_API.base = API_BASE;
window.WELONE_API.url = apiUrl;

const VISITOR_STORAGE_KEY = "neon_visitor_id";
const ADMIN_UNLOCK_KEY = "neon_admin_unlocked";
const WORKSPACE_KEY = "neon_workspace_mode";
const ADMIN_TOKEN_KEY = "neon_admin_token";
const FUTURE_THEME_KEY = "neon_future_mode";
const THEME_MODE_KEY = "neon_theme_mode";
const FUTURE_SHIP_MODEL_URL = "assets/models/command-jet.svg?v=20260218z13";
const MARIO_MODEL_URL = "assets/models/mario.svg";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_TOUCH_DEVICE = window.matchMedia("(hover: none), (pointer: coarse)").matches;
const LOGO_SECRET_TAP_TARGET = 2;
const WORKSPACE_EXIT_TAP_TARGET = 3;
const LOGO_TAP_RESET_MS = IS_TOUCH_DEVICE ? 1600 : 1200;
const LOGO_NAVIGATE_DELAY_MS = IS_TOUCH_DEVICE ? 700 : 380;
const ADMIN_TAP_RESET_MS = IS_TOUCH_DEVICE ? 1700 : 1300;
const MARIO_LONG_PRESS_MS = 2000;
const BRAND_LONG_PRESS_MOVE_TOLERANCE_PX = 18;

const marioPreloadImage = new Image();
marioPreloadImage.src = MARIO_MODEL_URL;

const futureShipPreloadImage = new Image();
futureShipPreloadImage.src = FUTURE_SHIP_MODEL_URL;

const ADADSW_SEQUENCE = ["KeyA", "KeyD", "KeyA", "KeyD", "KeyS", "KeyW"];
const FUTURE_SEQUENCE = ["KeyF", "KeyU", "KeyT", "KeyU", "KeyR", "KeyE"];
const FUTURE_SEQUENCE_WORD = FUTURE_SEQUENCE.map((code) => code.slice(3).toLowerCase()).join("");
const MIN_ENGAGEMENT_MS = 1500;
const MAX_ENGAGEMENT_MS = 1000 * 60 * 60 * 4;
const PAGE_START_TS = Date.now();

let konamiIndex = 0;
let logoTapCount = 0;
let logoTapTimer;
let logoNavigateTimer;
let workspaceTapCount = 0;
let workspaceTapTimer;
let adminTapCount = 0;
let adminTapTimer;
let typeSecret = "";
let toastHideTimer;
let secretModeTimer;
let themeTransitionTimer;
let futureSequenceRunning = false;
let engagementTracked = false;
let marioLongPressTimer;
let brandLongPressTriggered = false;
let brandTouchStartPoint = null;
let futureSecretPanel = null;
let futureSecretInput = null;
let futureSecretStatus = null;

function resolveKeyCodeToken(event) {
  if (typeof event.code === "string" && /^Key[A-Z]$/.test(event.code)) {
    return event.code;
  }

  const key = typeof event.key === "string" ? event.key : "";
  if (key.length === 1 && /[a-z]/i.test(key)) {
    return `Key${key.toUpperCase()}`;
  }

  return "";
}

window.addEventListener("load", () => {
  window.setTimeout(() => {
    preloader?.classList.add("is-hidden");
  }, 450);
});

if (cursorGlow) {
  window.addEventListener("pointermove", (event) => {
    if (
      document.body.classList.contains("workspace-mode") ||
      document.body.classList.contains("future-cinematic-running")
    ) {
      return;
    }
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
  });
}

if (menuToggle && siteNav) {
  const setMenuOpen = (isOpen) => {
    const nextOpen = Boolean(isOpen);
    menuToggle.setAttribute("aria-expanded", String(nextOpen));
    menuToggle.setAttribute("aria-label", nextOpen ? "Закрыть меню" : "Открыть меню");
    menuToggle.textContent = nextOpen ? "Закрыть" : "Меню";
    siteNav.classList.toggle("is-open", nextOpen);
    document.body.classList.toggle("menu-open", nextOpen);
  };

  setMenuOpen(false);

  menuToggle.addEventListener("click", () => {
    const expanded = menuToggle.getAttribute("aria-expanded") === "true";
    setMenuOpen(!expanded);
  });

  siteNav.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", () => {
      setMenuOpen(false);
    });
  });

  document.addEventListener("click", (event) => {
    if (!siteNav.classList.contains("is-open")) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (siteNav.contains(target) || menuToggle.contains(target)) {
      return;
    }

    setMenuOpen(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) {
      setMenuOpen(false);
    }
  });
}

function isLightMode() {
  return document.body.classList.contains("light-mode");
}

function readThemeMode() {
  try {
    return localStorage.getItem(THEME_MODE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function writeThemeMode(mode) {
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // Ignore storage restrictions.
  }
}

function updateThemeToggleLabel() {
  if (!themeToggle) {
    return;
  }

  if (isLightMode()) {
    themeToggle.textContent = "Тёмный режим";
    themeToggle.setAttribute("aria-label", "Переключить на тёмный режим");
  } else {
    themeToggle.textContent = "Светлый режим";
    themeToggle.setAttribute("aria-label", "Переключить на светлый режим");
  }
}

function setFutureThemeState(isEnabled) {
  const canEnable = !isLightMode();
  const finalState = Boolean(isEnabled) && canEnable;
  document.body.classList.toggle("future-mode", finalState);
  return finalState;
}

function readFutureThemeState() {
  try {
    return localStorage.getItem(FUTURE_THEME_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFutureThemeState(isEnabled) {
  try {
    if (isEnabled) {
      localStorage.setItem(FUTURE_THEME_KEY, "1");
    } else {
      localStorage.removeItem(FUTURE_THEME_KEY);
    }
  } catch {
    // Ignore storage restrictions.
  }
}

function startThemeTransition() {
  document.body.classList.add("theme-transitioning");
  window.clearTimeout(themeTransitionTimer);
  themeTransitionTimer = window.setTimeout(() => {
    document.body.classList.remove("theme-transitioning");
  }, 620);
}

function applyThemeMode(mode, options = {}) {
  const { persist = true, withTransition = true } = options;
  const nextMode = mode === "light" ? "light" : "dark";
  const useLight = nextMode === "light";

  if (withTransition) {
    startThemeTransition();
  }

  document.body.classList.toggle("light-mode", useLight);

  if (useLight) {
    setFutureThemeState(false);
    writeFutureThemeState(false);
  } else {
    setFutureThemeState(readFutureThemeState());
  }

  if (persist) {
    writeThemeMode(nextMode);
  }

  updateThemeToggleLabel();
}

applyThemeMode(readThemeMode(), { persist: false, withTransition: false });

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    if (isLightMode()) {
      applyThemeMode("dark");
      return;
    }

    applyThemeMode("light");
  });
}

function getSecretToast() {
  let toast = document.getElementById("secretToast");
  if (toast) {
    return toast;
  }

  toast = document.createElement("div");
  toast.id = "secretToast";
  toast.className = "secret-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.innerHTML =
    "<span class=\"secret-toast__pulse\" aria-hidden=\"true\"></span><p class=\"secret-toast__text\"></p>";

  document.body.appendChild(toast);
  return toast;
}

function showSecretToast(message) {
  const toast = getSecretToast();
  const text = toast.querySelector(".secret-toast__text");
  const normalizedMessage =
    typeof message === "string"
      ? { text: message }
      : message && typeof message === "object"
        ? message
        : { text: "" };
  const nextMessage =
    typeof normalizedMessage.text === "string" && normalizedMessage.text.trim()
      ? normalizedMessage.text.trim()
      : "Готово.";
  const linkText =
    typeof normalizedMessage.linkText === "string" ? normalizedMessage.linkText.trim() : "";
  const linkHref =
    typeof normalizedMessage.linkHref === "string" ? normalizedMessage.linkHref.trim() : "";

  if (text) {
    text.textContent = "";

    if (linkText && linkHref && nextMessage.includes(linkText)) {
      const [before, ...rest] = nextMessage.split(linkText);
      const after = rest.join(linkText);

      if (before) {
        text.append(before);
      }

      const link = document.createElement("a");
      link.className = "secret-toast__link";
      link.href = linkHref;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = linkText;
      link.setAttribute("aria-label", `${linkText} (откроется в новой вкладке)`);
      text.append(link);

      if (after) {
        text.append(after);
      }
    } else {
      text.textContent = nextMessage;
    }
  }

  toast.classList.remove("is-visible");
  void toast.offsetWidth;
  toast.classList.add("is-visible");

  window.clearTimeout(toastHideTimer);
  toastHideTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3300);
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function getFutureCinematicLayer() {
  let layer = document.getElementById("futureCinematic");
  if (layer) {
    return layer;
  }

  layer = document.createElement("div");
  layer.id = "futureCinematic";
  layer.className = "future-cinematic";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <div class="future-cinematic__paint"></div>
    <div class="future-cinematic__trail"></div>
    <img class="future-cinematic__ship" src="${FUTURE_SHIP_MODEL_URL}" alt="" decoding="async" />
    <div class="future-cinematic__spark"></div>
  `;

  document.body.appendChild(layer);
  return layer;
}

function playFutureShipCinematic(turnOn) {
  if (REDUCED_MOTION) {
    return wait(120);
  }

  const layer = getFutureCinematicLayer();
  const duration = turnOn ? 1000 : 850;
  const ship = layer.querySelector(".future-cinematic__ship");
  const expectedAnimationName = turnOn ? "futureShipFly" : "futureShipReturn";
  document.body.classList.add("future-cinematic-running");
  layer.classList.remove("is-run", "is-reverse");
  layer.classList.toggle("is-reverse", !turnOn);

  if (!ship) {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        layer.classList.add("is-run");
        void wait(duration + 120).then(() => {
          layer.classList.remove("is-run", "is-reverse");
          resolve();
        });
      });
    });
  }

  return new Promise((resolve) => {
    let finished = false;
    let fallbackTimer;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      window.clearTimeout(fallbackTimer);
      ship.removeEventListener("animationend", handleAnimationEnd);
      layer.classList.remove("is-run", "is-reverse");
      resolve();
    };

    const handleAnimationEnd = (event) => {
      if (!(event instanceof AnimationEvent)) {
        finish();
        return;
      }
      if (event.animationName !== expectedAnimationName) {
        return;
      }
      finish();
    };

    ship.addEventListener("animationend", handleAnimationEnd);
    // Safety: if the event is missed, we still finish.
    fallbackTimer = window.setTimeout(finish, duration + 240);

    window.requestAnimationFrame(() => {
      layer.classList.add("is-run");
    });
  });
}

async function runFutureSecretSequence() {
  if (futureSequenceRunning) {
    return;
  }

  if (isLightMode()) {
    activateSecretMode("Этот режим доступен только в темной теме.");
    return;
  }

  futureSequenceRunning = true;
  const turningOn = !document.body.classList.contains("future-mode");

  try {
    await playFutureShipCinematic(turningOn);

    // Toggle theme while the page background layers are still disabled.
    const applied = setFutureThemeState(turningOn);
    writeFutureThemeState(applied);

    await new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });

    document.body.classList.remove("future-cinematic-running");

    const toastMessage = turningOn
      ? "Дополнительный визуальный режим включен."
      : "Дополнительный визуальный режим отключен.";
    showSecretToast(toastMessage);
    trackSecretDiscovery("future");
  } finally {
    futureSequenceRunning = false;
    document.body.classList.remove("future-cinematic-running");
  }
}

function getMarioCameo() {
  let cameo = document.getElementById("marioCameo");
  if (cameo) {
    return cameo;
  }

  cameo = document.createElement("div");
  cameo.id = "marioCameo";
  cameo.className = "mario-cameo";
  cameo.setAttribute("aria-hidden", "true");
  cameo.innerHTML = `
    <span class="mario-cameo__shadow"></span>
    <img class="mario-cameo__sprite" src="${MARIO_MODEL_URL}" alt="" decoding="async" />
  `;

  if (IS_TOUCH_DEVICE) {
    cameo.setAttribute("role", "button");
    cameo.setAttribute("aria-label", "Открыть ввод для режима future");
    cameo.tabIndex = -1;
    cameo.addEventListener("click", () => {
      if (!cameo.classList.contains("is-interactive")) {
        return;
      }
      openFutureSecretPanel();
    });
    cameo.addEventListener("keydown", (event) => {
      if (!cameo.classList.contains("is-interactive")) {
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      openFutureSecretPanel();
    });
  }

  document.body.appendChild(cameo);
  return cameo;
}

function playMarioCameo() {
  const cameo = getMarioCameo();
  cameo.classList.remove("is-run", "is-run-reduced");
  void cameo.offsetWidth;

  if (IS_TOUCH_DEVICE) {
    cameo.classList.add("is-interactive");
    cameo.setAttribute("aria-hidden", "false");
    cameo.tabIndex = 0;
    return;
  }

  if (REDUCED_MOTION) {
    cameo.classList.add("is-run-reduced");
    window.setTimeout(() => {
      cameo.classList.remove("is-run-reduced");
    }, 1300);
    return;
  }

  cameo.classList.add("is-run");
  window.setTimeout(() => {
    cameo.classList.remove("is-run");
  }, 2650);
}

function setFutureSecretPanelStatus(message, color = "") {
  if (!futureSecretStatus) {
    return;
  }
  futureSecretStatus.textContent = message;
  if (color) {
    futureSecretStatus.style.color = color;
  } else {
    futureSecretStatus.style.removeProperty("color");
  }
}

function closeFutureSecretPanel() {
  if (!futureSecretPanel) {
    return;
  }
  futureSecretPanel.hidden = true;
  futureSecretPanel.setAttribute("aria-hidden", "true");
}

function ensureFutureSecretPanel() {
  if (futureSecretPanel) {
    return;
  }

  futureSecretPanel = document.createElement("section");
  futureSecretPanel.id = "futureSecretPanel";
  futureSecretPanel.className = "future-secret-panel";
  futureSecretPanel.hidden = true;
  futureSecretPanel.setAttribute("aria-hidden", "true");
  futureSecretPanel.innerHTML = `
    <button class="future-secret-panel__close" id="futureSecretClose" type="button" aria-label="Закрыть">×</button>
    <p class="future-secret-panel__title">Future Mode</p>
    <p class="future-secret-panel__hint">Введите кодовое слово.</p>
    <form class="future-secret-panel__form" id="futureSecretForm" autocomplete="off">
      <input id="futureSecretInput" name="futureWord" type="text" maxlength="24" placeholder="future" aria-label="Слово для активации future режима" />
      <button class="btn btn--primary" type="submit">OK</button>
    </form>
    <p class="future-secret-panel__status" id="futureSecretStatus" aria-live="polite"></p>
  `;

  document.body.appendChild(futureSecretPanel);

  const form = document.getElementById("futureSecretForm");
  const closeButton = document.getElementById("futureSecretClose");
  futureSecretInput = document.getElementById("futureSecretInput");
  futureSecretStatus = document.getElementById("futureSecretStatus");

  closeButton?.addEventListener("click", () => {
    closeFutureSecretPanel();
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const attempt = String(futureSecretInput?.value || "").trim().toLowerCase();

    if (attempt !== FUTURE_SEQUENCE_WORD) {
      setFutureSecretPanelStatus("Неверное слово. Введите: future.", "#ff9f9f");
      futureSecretInput?.focus();
      futureSecretInput?.select();
      return;
    }

    closeFutureSecretPanel();
    setFutureSecretPanelStatus("", "");
    if (futureSecretInput) {
      futureSecretInput.value = "";
    }
    void runFutureSecretSequence();
  });
}

function openFutureSecretPanel() {
  if (!IS_TOUCH_DEVICE) {
    return;
  }

  ensureFutureSecretPanel();
  if (!futureSecretPanel) {
    return;
  }

  futureSecretPanel.hidden = false;
  futureSecretPanel.setAttribute("aria-hidden", "false");
  setFutureSecretPanelStatus("", "");
  if (futureSecretInput) {
    futureSecretInput.focus();
    futureSecretInput.select();
  }
}

function setHiddenAccessState(isUnlocked, isOwner) {
  if (leadsNavLink) {
    leadsNavLink.classList.toggle("is-hidden-link", !isUnlocked);
    leadsNavLink.setAttribute("aria-hidden", String(!isUnlocked));
    leadsNavLink.tabIndex = isUnlocked ? 0 : -1;
  }

  const showAdminLink = Boolean(isUnlocked);
  if (adminNavLink) {
    adminNavLink.classList.toggle("is-hidden-link", !showAdminLink);
    adminNavLink.setAttribute("aria-hidden", String(!showAdminLink));
    adminNavLink.tabIndex = showAdminLink ? 0 : -1;
  }

  if (adminHotspot) {
    adminHotspot.classList.toggle("is-unlocked", isUnlocked);
    adminHotspot.hidden = isUnlocked;
  }
}

function readAdminUnlockState() {
  try {
    return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAdminUnlockState(isUnlocked) {
  try {
    if (isUnlocked) {
      sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1");
    } else {
      sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
    }
  } catch {
    // Ignore storage restrictions.
  }
}

function readWorkspaceState() {
  try {
    return sessionStorage.getItem(WORKSPACE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeWorkspaceState(isEnabled) {
  try {
    if (isEnabled) {
      sessionStorage.setItem(WORKSPACE_KEY, "1");
    } else {
      sessionStorage.removeItem(WORKSPACE_KEY);
    }
  } catch {
    // Ignore storage restrictions.
  }
}

function isWorkspaceMode() {
  return document.body.classList.contains("workspace-mode") || readWorkspaceState();
}

const BRAND_HTML_VISITOR =
  '<span class="brand-initial">W</span>elone <span class="brand-initial">D</span>igital <span class="brand-initial">A</span>telier';
const BRAND_HTML_COMMAND = `${BRAND_HTML_VISITOR} <span class="brand-initial">C</span>ommand`;

function setBrandVariant(variant) {
  if (!brandTrigger) {
    return;
  }

  const nextVariant = variant === "command" ? "command" : "visitor";
  if (brandTrigger.dataset.brandVariant === nextVariant) {
    return;
  }

  brandTrigger.innerHTML = nextVariant === "command" ? BRAND_HTML_COMMAND : BRAND_HTML_VISITOR;
  brandTrigger.dataset.brandVariant = nextVariant;
}

function syncBrandVariant() {
  const isAdminPage = document.body?.dataset?.page === "admin";
  const shouldUseCommand = isAdminPage || isWorkspaceMode();
  setBrandVariant(shouldUseCommand ? "command" : "visitor");
}

function setWorkspaceNavigationState(isEnabled) {
  if (!siteNav) {
    return;
  }

  const navLinks = Array.from(siteNav.querySelectorAll("a[href]"));
  navLinks.forEach((link) => {
    const href = String(link.getAttribute("href") || "").toLowerCase();
    const isWorkspaceLink = href.endsWith("admin.html") || href.endsWith("admin-leads.html");
    link.classList.toggle("workspace-nav-hidden", Boolean(isEnabled) && !isWorkspaceLink);
  });

  if (themeToggle) {
    themeToggle.classList.toggle("workspace-nav-hidden", Boolean(isEnabled));
  }
}

function ensureWorkspaceShell() {
  const main = document.querySelector("main");
  if (!main) {
    return null;
  }

  let shell = document.getElementById("workspaceShell");
  if (shell) {
    return shell;
  }

  shell = document.createElement("section");
  shell.id = "workspaceShell";
  shell.className = "workspace-shell";
  shell.hidden = true;
  shell.innerHTML = `
    <header class="workspace-shell__head">
      <div>
        <p class="workspace-shell__kicker">Workspace</p>
        <h1>Операционный центр</h1>
        <p class="workspace-shell__lead">Рабочий режим активен. Доступны инструменты команды.</p>
      </div>
    </header>
    <section class="workspace-shell__quick">
      <a class="workspace-tile workspace-tile--primary" href="admin-leads.html">
        <h2>Заявки</h2>
        <p>Очередь обращений, фильтры, статусы и приоритеты.</p>
      </a>
      <a class="workspace-tile" href="admin.html">
        <h2>Статистика</h2>
        <p>Трафик, повторы, время просмотра и динамика.</p>
      </a>
    </section>
    <section class="workspace-shell__board">
      <article class="workspace-panel">
        <h3>Ежедневный цикл</h3>
        <ol>
          <li>Проверить новые заявки.</li>
          <li>Назначить ответственных.</li>
          <li>Обновить приоритеты и статусы.</li>
        </ol>
      </article>
      <article class="workspace-panel">
        <h3>Стандарт команды</h3>
        <ul>
          <li>Высокий приоритет: реакция до 30 минут.</li>
          <li>Любое изменение сразу фиксируется.</li>
          <li>Незавершенные задачи остаются в состоянии in_progress.</li>
        </ul>
      </article>
    </section>
    <p class="workspace-shell__status" id="workspaceStatus" aria-live="polite">Выход: нажмите логотип 3 раза.</p>
  `;

  main.prepend(shell);

  return shell;
}

function setWorkspaceStatus(message) {
  const status = document.getElementById("workspaceStatus");
  if (!status) {
    return;
  }
  status.textContent = String(message || "");
}

function setWorkspaceState(isEnabled, options = {}) {
  const { persist = true } = options;
  const nextState = Boolean(isEnabled);
  const shell = ensureWorkspaceShell();
  const isAdminPage = document.body?.dataset?.page === "admin";

  if (nextState) {
    workspaceTapCount = 0;
    window.clearTimeout(workspaceTapTimer);
    setWorkspaceStatus("Выход: нажмите логотип 3 раза.");
  }

  document.body.classList.toggle("workspace-mode", nextState);
  if (shell) {
    shell.hidden = !nextState || isAdminPage;
  }

  setWorkspaceNavigationState(nextState);

  if (nextState) {
    setHiddenAccessState(true, false);
  } else {
    const unlocked = readAdminUnlockState();
    if (unlocked) {
      void syncUnlockedAccessLinks();
    } else {
      setHiddenAccessState(false, false);
    }
  }

  if (persist) {
    writeWorkspaceState(nextState);
  }

  syncBrandVariant();
}

function exitWorkspaceMode() {
  writeWorkspaceState(false);
  writeAdminUnlockState(false);
  setWorkspaceState(false, { persist: false });
  showSecretToast("Workspace выключен.");

  if (document.body?.dataset?.page === "admin") {
    window.setTimeout(() => {
      window.location.href = "index.html";
    }, 120);
  }
}

function initWorkspaceMode() {
  if (readWorkspaceState()) {
    setWorkspaceState(true, { persist: false });
  }
}

function readAdminToken() {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function clearAdminToken() {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // Ignore storage restrictions.
  }
}

async function resolveOwnerRoleFromSession() {
  if (!API_IS_AVAILABLE) {
    return false;
  }

  const token = readAdminToken();
  if (!token) {
    return false;
  }

  try {
    const response = await fetch(apiUrl("/api/admin/me"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`
      },
      cache: "no-store"
    });

    if (!response.ok) {
      if (response.status === 401) {
        clearAdminToken();
      }
      return false;
    }

    const payload = await response.json().catch(() => ({}));
    return payload?.actor?.role === "owner";
  } catch {
    return false;
  }
}

async function syncUnlockedAccessLinks() {
  const isUnlocked = readAdminUnlockState();
  if (!isUnlocked) {
    setHiddenAccessState(false, false);
    return;
  }

  const isOwner = await resolveOwnerRoleFromSession();
  setHiddenAccessState(true, isOwner);
}

function initSecretAdminTrigger() {
  if (!adminHotspot || !leadsNavLink || !adminNavLink) {
    return;
  }

  const isAdminPage = document.body?.dataset?.page === "admin";
  if (isAdminPage) {
    return;
  }

  setHiddenAccessState(false, false);
  void syncUnlockedAccessLinks();

  adminHotspot.addEventListener("click", () => {
    adminTapCount += 1;
    window.clearTimeout(adminTapTimer);

    adminTapTimer = window.setTimeout(() => {
      adminTapCount = 0;
    }, ADMIN_TAP_RESET_MS);

    if (adminTapCount >= 3) {
      writeAdminUnlockState(true);
      writeWorkspaceState(true);
      adminTapCount = 0;
      setHiddenAccessState(true, false);
      void syncUnlockedAccessLinks();
      setWorkspaceState(true, { persist: false });
    }
  });
}

initSecretAdminTrigger();
initWorkspaceMode();
syncBrandVariant();

const revealItems = Array.from(document.querySelectorAll(".reveal"));
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18 }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => {
    item.classList.add("in-view");
  });
}

const links = Array.from(document.querySelectorAll("a[href$='.html']"));
links.forEach((link) => {
  if (link.id === "brandTrigger") {
    return;
  }

  link.addEventListener("click", (event) => {
    const href = link.getAttribute("href");
    if (
      !href ||
      link.target === "_blank" ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.hasAttribute("download")
    ) {
      return;
    }

    const currentUrl = new URL(window.location.href);
    const nextUrl = new URL(href, window.location.href);

    if (nextUrl.origin !== currentUrl.origin) {
      return;
    }

    if (
      nextUrl.pathname === currentUrl.pathname &&
      nextUrl.search === currentUrl.search &&
      nextUrl.hash === currentUrl.hash
    ) {
      return;
    }

    event.preventDefault();
    document.body.classList.add("page-leave");
    window.setTimeout(() => {
      window.location.href = href;
    }, 260);
  });
});

function generateVisitorId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `v_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function getVisitorId() {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const nextId = generateVisitorId();
    localStorage.setItem(VISITOR_STORAGE_KEY, nextId);
    return nextId;
  } catch {
    return generateVisitorId();
  }
}

function sendBackgroundJson(pathname, payload) {
  if (!API_IS_AVAILABLE) {
    return;
  }

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const queued = navigator.sendBeacon(pathname, blob);
      if (queued) {
        return;
      }
    } catch {
      // Fallback to fetch below.
    }
  }

  fetch(pathname, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {
    // No user-facing warning for analytics failures.
  });
}

function trackVisit() {
  if (!API_IS_AVAILABLE) {
    return;
  }

  if (document.body?.dataset?.page === "admin") {
    return;
  }

  if (isWorkspaceMode()) {
    return;
  }

  const payload = {
    visitorId: getVisitorId(),
    path: window.location.pathname || "index.html",
    referrer: document.referrer || "",
    userAgent: navigator.userAgent || ""
  };

  sendBackgroundJson(apiUrl("/api/visit"), payload);
}

trackVisit();

function trackEngagementDuration() {
  if (!API_IS_AVAILABLE || engagementTracked) {
    return;
  }

  if (document.body?.dataset?.page === "admin") {
    return;
  }

  if (isWorkspaceMode()) {
    return;
  }

  const durationMs = Math.min(MAX_ENGAGEMENT_MS, Math.max(0, Date.now() - PAGE_START_TS));
  if (durationMs < MIN_ENGAGEMENT_MS) {
    return;
  }

  engagementTracked = true;
  sendBackgroundJson(apiUrl("/api/engagement"), {
    visitorId: getVisitorId(),
    path: window.location.pathname || "index.html",
    durationMs
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    trackEngagementDuration();
  }
});

window.addEventListener("pagehide", () => {
  trackEngagementDuration();
});

const filters = document.getElementById("filters");
if (filters) {
  const buttons = Array.from(filters.querySelectorAll("button[data-filter]"));
  const cards = Array.from(document.querySelectorAll(".project-card"));
  const projectFilterStatus = document.getElementById("projectFilterStatus");
  const projectsControls = document.querySelector(".projects-controls");
  const filtersJump = document.getElementById("filtersJump");
  const projectLabels = {
    all: "все",
    version: "версии",
    final: "финал",
    special: "special"
  };

  const updateProjectFilterStatus = (filter) => {
    if (!projectFilterStatus) {
      return;
    }

    const visibleCount = cards.filter((card) => !card.classList.contains("is-hidden")).length;
    const totalCount = cards.length;
    const label = projectLabels[filter] || filter;

    if (visibleCount === 0) {
      projectFilterStatus.textContent = "По выбранному фильтру пока нет работ.";
      return;
    }

    if (filter === "all") {
      projectFilterStatus.textContent = `Показано проектов: ${visibleCount} из ${totalCount}.`;
      return;
    }

    projectFilterStatus.textContent = `Показано ${visibleCount} из ${totalCount}: ${label}.`;
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      buttons.forEach((btn) => btn.classList.remove("is-active"));
      button.classList.add("is-active");

      cards.forEach((card) => {
        const category = card.dataset.category;
        const visible = filter === "all" || category === filter;
        card.classList.toggle("is-hidden", !visible);
      });

      updateProjectFilterStatus(filter);
    });
  });

  updateProjectFilterStatus("all");

  if (filtersJump && projectsControls) {
    const syncFiltersJumpVisibility = () => {
      const threshold = projectsControls.offsetTop + projectsControls.offsetHeight;
      const isVisible = window.scrollY > threshold;
      filtersJump.classList.toggle("is-visible", isVisible);
    };

    filtersJump.addEventListener("click", () => {
      projectsControls.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    window.addEventListener("scroll", syncFiltersJumpVisibility, { passive: true });
    window.addEventListener("resize", syncFiltersJumpVisibility);
    syncFiltersJumpVisibility();
  }
}

const tiltCards = Array.from(document.querySelectorAll(".tilt"));
const canUseTilt = !REDUCED_MOTION && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (canUseTilt) {
  tiltCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateX = (y / rect.height - 0.5) * -8;
      const rotateY = (x / rect.width - 0.5) * 10;
      card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    card.addEventListener("pointerleave", () => {
      card.style.transform = "perspective(700px) rotateX(0deg) rotateY(0deg)";
    });
  });
}

const signalScanner = document.getElementById("signalScanner");
if (signalScanner) {
  const output = document.getElementById("signalOutput");
  const items = Array.from(signalScanner.querySelectorAll(".signal__item"));

  items.forEach((item) => {
    const handler = () => {
      const level = item.dataset.level;
      const skill = item.dataset.skill;
      if (output) {
        output.textContent = `${skill}: ${level}%`;
      }
    };

    item.addEventListener("mouseenter", handler);
    item.addEventListener("click", handler);
    item.addEventListener("focus", handler);
  });
}

const contactForm = document.querySelector(".contact-form");
if (contactForm) {
  const note = contactForm.querySelector(".form-note");
  const submitButton = contactForm.querySelector("button[type='submit']");

  if (!API_IS_AVAILABLE && note) {
    note.textContent = "Отправка формы недоступна. Напишите в Telegram или по телефону.";
    note.style.color = "#ffd6a7";
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!API_IS_AVAILABLE) {
      if (note) {
        note.textContent = "Отправка формы недоступна. Напишите в Telegram или по телефону.";
        note.style.color = "#ff9f9f";
      }
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    if (note) {
      note.textContent = "Отправляю заявку...";
      note.style.color = "#ffe5c8";
    }

    const formData = new FormData(contactForm);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      contact: String(formData.get("contact") || "").trim(),
      type: String(formData.get("type") || "").trim(),
      message: String(formData.get("message") || "").trim(),
      sourcePage: window.location.pathname || "contact.html"
    };

    try {
      const response = await fetch(apiUrl("/api/leads"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("REQUEST_FAILED");
      }

      if (note) {
        note.textContent = "Заявка успешно получена. Свяжусь с вами в течение 1 рабочего дня.";
        note.style.color = "#d8ffd2";
      }

      contactForm.reset();
    } catch {
      if (note) {
        note.textContent = "Не удалось отправить форму. Напишите в Telegram или по телефону.";
        note.style.color = "#ff9f9f";
      }
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}

function trackSecretDiscovery(secretId) {
  if (!secretId || !API_IS_AVAILABLE) {
    return;
  }

  if (document.body?.dataset?.page === "admin") {
    return;
  }

  if (isWorkspaceMode()) {
    return;
  }

  const secret = String(secretId).trim().toLowerCase().slice(0, 80);
  if (!secret) {
    return;
  }

  sendBackgroundJson(apiUrl("/api/secret"), {
    visitorId: getVisitorId(),
    path: window.location.pathname || "index.html",
    secret
  });
}

function activateSecretMode(message, secretId = "") {
  if (isWorkspaceMode()) {
    return;
  }

  document.body.classList.add("secret-mode");
  window.clearTimeout(secretModeTimer);
  secretModeTimer = window.setTimeout(() => {
    document.body.classList.remove("secret-mode");
  }, 3600);
  showSecretToast(message);
  trackSecretDiscovery(secretId);
}

function isTypingContext(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.isContentEditable || target.closest("[contenteditable='true']")) {
    return true;
  }

  const field = target.closest("input, textarea, select");
  return Boolean(field);
}

function processMarioSequenceToken(keyCodeToken) {
  if (!keyCodeToken) {
    return;
  }

  if (keyCodeToken === ADADSW_SEQUENCE[konamiIndex]) {
    konamiIndex += 1;
    if (konamiIndex === ADADSW_SEQUENCE.length) {
      triggerMarioSecret("adadsw");
      konamiIndex = 0;
    }
    return;
  }

  konamiIndex = keyCodeToken === ADADSW_SEQUENCE[0] ? 1 : 0;
}

function triggerMarioSecret(secretId) {
  if (isWorkspaceMode()) {
    return;
  }

  playMarioCameo();
  if (IS_TOUCH_DEVICE) {
    activateSecretMode("Mario активирован. Нажмите на него и введите слово future.", secretId);
    return;
  }
  activateSecretMode("Найден секретный бонус.", secretId);
}

window.addEventListener("keydown", (event) => {
  if (isWorkspaceMode()) {
    return;
  }

  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }

  if (isTypingContext(event.target)) {
    return;
  }

  const keyCodeToken = resolveKeyCodeToken(event);
  processMarioSequenceToken(keyCodeToken);

  if (keyCodeToken) {
    typeSecret = `${typeSecret}${keyCodeToken.slice(3).toLowerCase()}`.slice(-FUTURE_SEQUENCE.length);
    if (typeSecret === FUTURE_SEQUENCE_WORD) {
      typeSecret = "";
      void runFutureSecretSequence();
    }
  }
});

if (brandTrigger) {
  if (IS_TOUCH_DEVICE) {
    const clearBrandLongPressTimer = () => {
      window.clearTimeout(marioLongPressTimer);
      marioLongPressTimer = undefined;
    };

    const clearBrandTouchState = () => {
      clearBrandLongPressTimer();
      brandTouchStartPoint = null;
    };

    brandTrigger.addEventListener(
      "touchstart",
      (event) => {
        if (isWorkspaceMode() || event.touches.length !== 1 || isTypingContext(event.target)) {
          clearBrandTouchState();
          return;
        }

        const touch = event.touches[0];
        brandTouchStartPoint = {
          x: touch.clientX,
          y: touch.clientY
        };
        brandLongPressTriggered = false;
        clearBrandLongPressTimer();
        marioLongPressTimer = window.setTimeout(() => {
          brandLongPressTriggered = true;
          logoTapCount = 0;
          clearBrandLongPressTimer();
          window.clearTimeout(logoTapTimer);
          window.clearTimeout(logoNavigateTimer);
          triggerMarioSecret("logo-longpress-2s");
        }, MARIO_LONG_PRESS_MS);
      },
      { passive: true }
    );

    brandTrigger.addEventListener(
      "touchmove",
      (event) => {
        if (!brandTouchStartPoint || event.touches.length !== 1) {
          return;
        }

        const touch = event.touches[0];
        const moveDistance = Math.hypot(
          touch.clientX - brandTouchStartPoint.x,
          touch.clientY - brandTouchStartPoint.y
        );
        if (moveDistance > BRAND_LONG_PRESS_MOVE_TOLERANCE_PX) {
          clearBrandTouchState();
        }
      },
      { passive: true }
    );

    brandTrigger.addEventListener(
      "touchend",
      () => {
        clearBrandTouchState();
      },
      { passive: true }
    );

    brandTrigger.addEventListener(
      "touchcancel",
      () => {
        clearBrandTouchState();
      },
      { passive: true }
    );
  }

  brandTrigger.addEventListener("click", (event) => {
    event.preventDefault();

    if (isWorkspaceMode()) {
      workspaceTapCount += 1;
      window.clearTimeout(workspaceTapTimer);
      workspaceTapTimer = window.setTimeout(() => {
        workspaceTapCount = 0;
        setWorkspaceStatus("Выход: нажмите логотип 3 раза.");
      }, LOGO_TAP_RESET_MS);

      if (workspaceTapCount >= WORKSPACE_EXIT_TAP_TARGET) {
        workspaceTapCount = 0;
        exitWorkspaceMode();
      } else {
        const remaining = WORKSPACE_EXIT_TAP_TARGET - workspaceTapCount;
        setWorkspaceStatus(`Для выхода из Workspace нажмите логотип еще ${remaining} раз.`);
      }
      return;
    }

    if (brandLongPressTriggered) {
      brandLongPressTriggered = false;
      return;
    }

    logoTapCount += 1;
    window.clearTimeout(logoTapTimer);
    window.clearTimeout(logoNavigateTimer);

    logoTapTimer = window.setTimeout(() => {
      logoTapCount = 0;
    }, LOGO_TAP_RESET_MS);

    if (logoTapCount >= LOGO_SECRET_TAP_TARGET) {
      activateSecretMode(
        {
          text: "Логотип разработан в дизайнерской студии Александры Николаевой.",
          linkText: "дизайнерской студии Александры Николаевой",
          linkHref: "https://weloneen.github.io/sashnazdemodemo/index.html"
        },
        "logo-2tap"
      );
      logoTapCount = 0;
      return;
    }

    const isHome = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");
    if (!isHome) {
      logoNavigateTimer = window.setTimeout(() => {
        window.location.href = "index.html";
      }, LOGO_NAVIGATE_DELAY_MS);
    }
  });
}
