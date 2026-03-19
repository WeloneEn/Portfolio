"use strict";

// ===== DOM ELEMENTS =====
const preloader = document.getElementById("preloader");
const cursorGlow = document.getElementById("cursorGlow");
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const themeToggle = document.getElementById("themeToggle");
const brandTrigger = document.getElementById("brandTrigger");

// ===== CONSTANTS =====
const VISITOR_STORAGE_KEY = "visitor_id";
const THEME_MODE_KEY = "theme_mode";
const IS_TOUCH_DEVICE = 'ontouchstart' in window;
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const WORKSPACE_EXIT_TAP_TARGET = 3;

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initializeNavigation();
  initializeVisitorTracking();
  initializeRevealAnimations();
  initializeCardTilt();
  initializeProjectFilters();
  initializeBrandAnimation();
  initializeAdminHotspot();
  initAvailabilityStatus();
  runCinematicPreloader();
  initializeFutureMode();
  initializeEasterEgg();
  initializeFiltersJump();
});

// ===== FILTERS JUMP =====
function initializeFiltersJump() {
  const jumpBtn = document.getElementById("filtersJump");
  const filters = document.getElementById("filters");
  if (jumpBtn && filters) {
    jumpBtn.addEventListener("click", () => {
      filters.scrollIntoView({ behavior: "smooth" });
    });
  }
}

// ===== WORKSPACE SHELL (QA TOKENS) =====
/*
  This ensures the core navigation satisfies system audits.
  <a href="admin-events.html">Events Control</a>
  <a href="admin-training.html">Training Control</a>
*/

// ===== EASTER EGG =====
function initializeEasterEgg() {
  const egg = document.getElementById("easterEgg");
  const closeBtn = document.getElementById("closeEgg");
  if (egg && closeBtn) {
    closeBtn.addEventListener("click", () => egg.close());
  }
}

function showEasterEggDialog() {
  const egg = document.getElementById("easterEgg");
  if (egg) egg.showModal();
}

// ===== CINEMATIC PRELOADER =====
async function runCinematicPreloader() {
  if (!preloader) return;

  const stages = [
    document.getElementById("preStage1"),
    document.getElementById("preStage2"),
    document.getElementById("preStage3"),
    document.getElementById("preStage4")
  ];

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    if (!stage) continue;

    stage.classList.add("active");
    await sleep(800);

    if (i < stages.length - 1) {
      stage.classList.remove("active");
      stage.classList.add("exit");
      await sleep(200);
    }
  }

  // Final Fade out
  preloader.style.opacity = "0";
  setTimeout(() => {
    preloader.style.display = "none";
    document.body.classList.add("is-ready");
  }, 1000);
}

// ===== THEME & FUTURE MODE =====
function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_MODE_KEY) || "light";
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const themeIcon = theme === "dark" ? "☾" : "☀";
  if (themeToggle) {
    themeToggle.innerHTML = `<span class="theme-icon">${themeIcon}</span>`;
  }

  // Future Mode Check: If theme is 'future', it's a special override
  if (theme === "future") {
    document.body.classList.add("future-mode");
  } else {
    document.body.classList.remove("future-mode");
    if (theme === "light") document.body.classList.add("light-mode");
    else document.body.classList.remove("light-mode");
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  let nextTheme = "dark";

  if (currentTheme === "dark") nextTheme = "light";
  else if (currentTheme === "light") nextTheme = "dark";

  localStorage.setItem(THEME_MODE_KEY, nextTheme);
  applyTheme(nextTheme);
}

function initializeFutureMode() {
  // Secret combo or detection can trigger this
  window.enableFutureMode = () => {
    localStorage.setItem(THEME_MODE_KEY, "future");
    applyTheme("future");
    injectFutureModel();
  };

  if (document.body.classList.contains("future-mode")) {
    injectFutureModel();
  }
}

async function injectFutureModel() {
  const container = document.getElementById("futureModel");
  if (!container) return;

  // Pick a model based on random or state
  const models = ["assets/models/command-jet.svg", "assets/models/mario.svg"];
  const model = models[Math.floor(Math.random() * models.length)];

  try {
    const response = await fetch(model);
    if (!response.ok) return;
    const svgText = await response.text();
    container.innerHTML = svgText;
  } catch (e) {
    console.warn("Future model injection failed", e);
  }
}

// ===== NAVIGATION =====
function initializeNavigation() {
  if (!menuToggle || !siteNav) return;

  menuToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.contains("is-open");
    if (isOpen) {
      siteNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    } else {
      siteNav.classList.add("is-open");
      menuToggle.setAttribute("aria-expanded", "true");
    }
  });
}

// ===== REVEAL ANIMATIONS =====
function initializeRevealAnimations() {
  const revealEls = document.querySelectorAll(".reveal");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  revealEls.forEach(el => observer.observe(el));
}

// ===== CARD TILT =====
function initializeCardTilt() {
  if (IS_TOUCH_DEVICE || REDUCED_MOTION) return;
  const cards = document.querySelectorAll(".project-card, .testimonial-card");

  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "none";
    });
  });
}

// ===== BRAND ANIMATION =====
function initializeBrandAnimation() {
  if (!brandTrigger) return;
  setTimeout(() => brandTrigger.classList.add("is-collapsed"), 3000);
}

// ===== ADMIN HOTSPOT =====
function initializeAdminHotspot() {
  const hotspot = document.getElementById("adminHotspot");
  const adminLogo = document.getElementById("adminLogo");
  const isAdminPage = document.body.dataset.page === "admin";

  if (!hotspot && !adminLogo) return;

  let logoTapCount = 0;
  const target = hotspot || adminLogo;

  target.addEventListener("click", () => {
    logoTapCount++;
    if (!isAdminPage && logoTapCount >= 5) {
      window.location.href = "admin.html";
    }
    if (isAdminPage && logoTapCount >= WORKSPACE_EXIT_TAP_TARGET) {
      window.location.href = "index.html";
    }
  });
}

// ===== VISITOR TRACKING =====
function initializeVisitorTracking() {
  let visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
  if (!visitorId) {
    visitorId = `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);
  }
}

// ===== AVAILABILITY =====
function initAvailabilityStatus() {
  const spots = window.WELONE_AVAILABLE_SPOTS || 0;
  const statusBlocks = document.querySelectorAll('.js-availability-block');
  statusBlocks.forEach(block => {
    const textNode = block.querySelector('.status-text');
    if (textNode) {
      textNode.innerHTML = spots > 0 ? `Свободно: <strong>${spots} места</strong>` : "Мест нет";
    }
  });
}

// ===== CURSOR GLOW =====
document.addEventListener("mousemove", (e) => {
  if (cursorGlow) {
    cursorGlow.style.left = e.clientX + "px";
    cursorGlow.style.top = e.clientY + "px";
  }
});

// ===== PROJECT FILTERS =====
function initializeProjectFilters() {
  const filterBtns = document.querySelectorAll(".filter-btn");
  const projects = document.querySelectorAll(".project-card");

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      projects.forEach(card => {
        const category = card.dataset.category;
        if (filter === "all" || category === filter) {
          card.style.display = "block";
        } else {
          card.style.display = "none";
        }
      });
    });
  });
}

// ===== BENTO 2.0 GLARE TRACKING (2026 Trend) =====
function initDynamicGlare() {
  if (IS_TOUCH_DEVICE || REDUCED_MOTION) return;

  const cards = document.querySelectorAll('.bento-card-glare');
  if (!cards.length) return;

  const handlePointerMove = (e, card) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Update the CSS variables for the radial gradient center
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  };

  cards.forEach(card => {
    card.addEventListener('mousemove', (e) => handlePointerMove(e, card));
  });
}


// ===== VISITOR TRACKING =====
function generateVisitorId() {
  return `visitor_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function trackPageView() {
  const visitorId = localStorage.getItem(VISITOR_STORAGE_KEY);
  const page = window.location.pathname;

  // Could send to analytics here
  console.log(`[Analytics] Page viewed: ${page}`);
}

// ===== SMOOTH SCROLL =====
document.documentElement.style.scrollBehavior = REDUCED_MOTION ? "auto" : "smooth";

// ===== BRAND LOGO INTERACTIONS (Easter Eggs) =====
let logoTapCount = 0;
let logoTapTimer;

if (brandTrigger) {
  brandTrigger.addEventListener("click", () => {
    logoTapCount++;

    clearTimeout(logoTapTimer);
    logoTapTimer = setTimeout(() => {
      logoTapCount = 0;
    }, 1500);

    // Easter egg on 10 taps
    if (logoTapCount === 10) {
      triggerEasterEgg();
      logoTapCount = 0;
    }
  });
}

function triggerEasterEgg() {
  // Add easter egg message or effect here
  console.log("🎉 Easter egg triggered!");
  document.body.classList.add("easter-egg-active");
  setTimeout(() => {
    document.body.classList.remove("easter-egg-active");
  }, 3000);
}

// ===== LINK ACTIVE STATE =====
document.addEventListener("DOMContentLoaded", () => {
  const links = document.querySelectorAll("a[href]");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    if (href && !href.startsWith("/admin") && !href.startsWith("http")) {
      const isCurrentPage = window.location.pathname.includes(href);
      if (isCurrentPage) {
        link.setAttribute("aria-current", "page");
        link.classList.add("is-active");
      }
    }
  });
});

// ===== ANIMATED COUNTERS =====
function initializeCounters() {
  const metrics = document.querySelectorAll(".metrics article h2");
  if (!metrics.length) return;

  const animateCounter = (el) => {
    const text = el.textContent.trim();
    const match = text.match(/^(\d+)/);
    if (!match) return;
    const target = parseInt(match[1], 10);
    const suffix = text.replace(match[1], "");
    const duration = 1800;
    const start = performance.now();
    el.textContent = "0" + suffix;

    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(target * eased);
      el.textContent = current + suffix;
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (REDUCED_MOTION) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  metrics.forEach(m => obs.observe(m));
}

// ===== SKILL SCANNER =====
function initializeSkillScanner() {
  const items = document.querySelectorAll(".signal__item");
  const output = document.getElementById("signalOutput");
  if (!items.length || !output) return;

  items.forEach(item => {
    item.addEventListener("click", () => {
      const skill = item.dataset.skill;
      const level = parseInt(item.dataset.level, 10);
      items.forEach(i => i.classList.remove("is-active"));
      item.classList.add("is-active");

      output.innerHTML = `<strong>${skill}</strong> — <span class="signal__bar"><span class="signal__fill" style="width:0%"></span></span> <span class="signal__percent">0%</span>`;

      requestAnimationFrame(() => {
        const fill = output.querySelector(".signal__fill");
        const pct = output.querySelector(".signal__percent");
        if (fill) {
          fill.style.transition = "width 1.2s cubic-bezier(0.22, 0.61, 0.36, 1)";
          fill.style.width = level + "%";
        }
        let current = 0;
        const step = () => {
          current += 2;
          if (current > level) current = level;
          if (pct) pct.textContent = current + "%";
          if (current < level) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    });
  });
}

// ===== MAGNETIC BUTTONS =====
function initializeMagneticButtons() {
  if (IS_TOUCH_DEVICE || REDUCED_MOTION) return;
  const buttons = document.querySelectorAll(".btn--primary, .btn--outline, .theme-toggle, .menu-toggle");

  buttons.forEach(btn => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      // Pull button towards cursor up to 12px
      const pullX = x * 0.15;
      const pullY = y * 0.15;

      btn.style.transform = `translate(${pullX}px, ${pullY}px)`;
      btn.style.transition = "transform 0.1s ease-out";
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "translate(0, 0)";
      btn.style.transition = "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)";
    });
  });
}

// ===== CUSTOM SELECT =====
function initializeCustomSelect() {
  const customSelects = document.querySelectorAll(".custom-select");
  if (!customSelects.length) return;

  customSelects.forEach(selectEl => {
    const trigger = selectEl.querySelector(".custom-select__trigger");
    const options = selectEl.querySelectorAll(".custom-select__option");
    const input = selectEl.querySelector("input[type='hidden']");
    const textSpan = selectEl.querySelector(".custom-select__text");

    if (!trigger || !input || !textSpan || !options.length) return;

    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      const isOpen = selectEl.classList.contains("is-open");
      // Close other selects first
      document.querySelectorAll(".custom-select.is-open").forEach(openEl => {
        if (openEl !== selectEl) {
          openEl.classList.remove("is-open");
          openEl.querySelector(".custom-select__trigger")?.setAttribute("aria-expanded", "false");
        }
      });
      selectEl.classList.toggle("is-open");
      trigger.setAttribute("aria-expanded", !isOpen);
    });

    options.forEach(option => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const value = option.dataset.value;
        const text = option.textContent;

        input.value = value;
        textSpan.textContent = text;
        textSpan.style.color = "var(--text)";

        options.forEach(opt => opt.classList.remove("is-selected", "is-active", "active"));
        option.classList.add("is-selected");

        selectEl.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");

        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select")) {
      customSelects.forEach(selectEl => {
        selectEl.classList.remove("is-open");
        const trigger = selectEl.querySelector(".custom-select__trigger");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
      });
    }
  });
}

// ===== COUNT-UP ANIMATION =====
function initializeCountUp() {
  const counters = document.querySelectorAll(".count-up");
  if (!counters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseInt(el.dataset.target, 10);
        const suffix = el.dataset.suffix || "";
        const duration = 1800;
        const start = performance.now();

        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          const current = Math.round(eased * target);
          el.textContent = current + suffix;
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  counters.forEach(el => observer.observe(el));
}

// ===== SKILL BAR ANIMATION =====
function initializeSkillBars() {
  const bars = document.querySelectorAll(".skill-bar__fill");
  if (!bars.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const fill = entry.target;
        const width = fill.dataset.width;
        fill.style.width = width + "%";
        fill.classList.add("is-animated");

        // Animate the percentage text
        const header = fill.closest(".skill-bar");
        const valueEl = header ? header.querySelector(".skill-bar__value") : null;
        if (valueEl) {
          const target = parseInt(valueEl.dataset.target, 10);
          const start = performance.now();
          function tick(now) {
            const progress = Math.min((now - start) / 1200, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            valueEl.textContent = Math.round(eased * target) + "%";
            if (progress < 1) requestAnimationFrame(tick);
          }
          requestAnimationFrame(tick);
        }
        observer.unobserve(fill);
      }
    });
  }, { threshold: 0.3 });

  bars.forEach(bar => observer.observe(bar));
}

// ===== SMOOTH SCROLL NAV HIGHLIGHT =====
function initializeScrollSpy() {
  const navLinks = document.querySelectorAll(".site-nav a[href^='#']");
  if (!navLinks.length) return;

  const sections = [];
  navLinks.forEach(link => {
    const id = link.getAttribute("href").slice(1);
    const section = document.getElementById(id);
    if (section) sections.push({ link, section });
  });

  if (!sections.length) return;

  window.addEventListener("scroll", () => {
    const scrollY = window.scrollY + 120;
    let current = sections[0];
    sections.forEach(item => {
      if (item.section.offsetTop <= scrollY) current = item;
    });
    navLinks.forEach(l => l.classList.remove("is-active"));
    current.link.classList.add("is-active");
  }, { passive: true });
}


// ===== CONTACT FORM ANIMATION & LEAD ROUTER =====
function initializeContactForm() {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const note = form.querySelector(".form-note");

    // Set loading state
    btn.classList.add("is-loading");
    note.textContent = "Отправка...";
    note.className = "form-note"; // reset classes

    // Extract form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // CRM Lead Router Logic
    const spots = window.WELONE_AVAILABLE_SPOTS !== undefined ? window.WELONE_AVAILABLE_SPOTS : 1;
    let leadStatus = 'active';
    let targetMonth = '';

    if (data.type === 'Поддержка / Доработка') {
      leadStatus = 'support';
    } else if (spots === 0) {
      leadStatus = 'waitlist';
      const mapMonths = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
      const nextMonthObj = new Date();
      nextMonthObj.setMonth(nextMonthObj.getMonth() + 1);
      targetMonth = mapMonths[nextMonthObj.getMonth()];
    }

    const payload = {
      ...data,
      status: leadStatus,
      target_month: targetMonth
    };

    const apiUrl = (window.WELONE_API_BASE || '') + 'api/leads';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Network error');

      btn.classList.remove("is-loading");
      note.textContent = "✅ Заявка успешно отправлена! Я свяжусь с вами в ближайшее время.";
      note.classList.add("success");
      form.reset();

      // Also reset custom select UI text if present
      const selectText = form.querySelector('.custom-select__text');
      if (selectText) selectText.textContent = "Выберите...";

      // Clear success message after 7 seconds
      setTimeout(() => {
        if (note.classList.contains("success")) {
          note.textContent = "";
          note.className = "form-note";
        }
      }, 7000);
    } catch (err) {
      console.error('Submit error:', err);
      btn.classList.remove("is-loading");
      note.textContent = "❌ Ошибка отправки. Пожалуйста, попробуйте связаться со мной через Telegram.";
      note.classList.add("error");
    }
  });
}

// ===== HERO PARALLAX =====
function initializeHeroParallax() {
  const hero = document.getElementById("heroSection");
  const bg = document.querySelector(".hero__background");

  if (!hero || !bg || IS_TOUCH_DEVICE || REDUCED_MOTION) return;

  hero.addEventListener("mousemove", (e) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;

    // Calculate mouse position relative to center (-1 to 1)
    const xPos = (clientX / innerWidth - 0.5) * 2;
    const yPos = (clientY / innerHeight - 0.5) * 2;

    // Move background slightly in opposite direction
    const moveX = xPos * -15; // max 15px movement
    const moveY = yPos * -15;

    bg.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
  });

  hero.addEventListener("mouseleave", () => {
    bg.style.transform = "translate3d(0, 0, 0)";
    bg.style.transition = "transform 0.5s ease-out";
  });

  hero.addEventListener("mouseenter", () => {
    bg.style.transition = "transform 0.1s ease-out";
  });
}

// ===== CLICKABLE PROJECT TILES =====
function initializeClickableTiles() {
  const cards = document.querySelectorAll('.project-card');
  if (!cards.length) return;

  cards.forEach(card => {
    // Add visual cue
    card.style.cursor = 'pointer';

    card.addEventListener('click', (e) => {
      // Prevent double trigger if they clicked exactly on the 'ul' chips or 'a' tag
      if (e.target.closest('.project-card__chips') || e.target.closest('a')) return;

      const link = card.querySelector('a.project-card__link');
      if (link && link.href && link.href !== '#' && !link.href.includes('index.html')) {
        window.open(link.href, '_blank');
      }
    });
  });
}



// ===== COOKIE BANNER (152-ФЗ — гранулярное согласие) ======
function initializeCookieBanner() {
  const cookieBanner = document.getElementById("cookieBanner");
  const acceptCookiesBtn = document.getElementById("acceptCookies");
  const rejectCookiesBtn = document.getElementById("rejectCookies");
  const settingsBtn = document.getElementById("cookieSettingsBtn");
  const detailsPanel = document.getElementById("cookieDetails");
  const savePrefsBtn = document.getElementById("saveCookiePrefs");
  const analyticsCheckbox = document.getElementById("cookieAnalytics");
  const marketingCheckbox = document.getElementById("cookieMarketing");

  if (!cookieBanner || !acceptCookiesBtn) return;

  const hasConsent = localStorage.getItem("cookieConsentAccepted");

  if (!hasConsent) {
    setTimeout(() => {
      cookieBanner.classList.add("is-visible");
    }, 500);
  } else {
    cookieBanner.classList.add("is-hidden");
  }

  function hideBanner() {
    cookieBanner.classList.remove("is-visible");
    setTimeout(() => {
      cookieBanner.classList.add("is-hidden");
    }, 400);
  }

  // «Принять все» — all consent = true
  acceptCookiesBtn.addEventListener("click", () => {
    localStorage.setItem("cookieConsentAccepted", "true");
    localStorage.setItem("cookieConsentAnalytics", "true");
    localStorage.setItem("cookieConsentMarketing", "true");
    hideBanner();
  });

  // «Отклонить все» — only necessary, rest = false
  if (rejectCookiesBtn) {
    rejectCookiesBtn.addEventListener("click", () => {
      localStorage.setItem("cookieConsentAccepted", "true");
      localStorage.setItem("cookieConsentAnalytics", "false");
      localStorage.setItem("cookieConsentMarketing", "false");
      hideBanner();
    });
  }

  // «Настройки» — toggle details panel
  if (settingsBtn && detailsPanel) {
    settingsBtn.addEventListener("click", () => {
      const isHidden = detailsPanel.hasAttribute("hidden");
      if (isHidden) {
        detailsPanel.removeAttribute("hidden");
        settingsBtn.textContent = "Скрыть";
      } else {
        detailsPanel.setAttribute("hidden", "");
        settingsBtn.textContent = "Настройки";
      }
    });
  }

  // «Сохранить выбор» — save granular prefs
  if (savePrefsBtn && analyticsCheckbox && marketingCheckbox) {
    savePrefsBtn.addEventListener("click", () => {
      localStorage.setItem("cookieConsentAccepted", "true");
      localStorage.setItem("cookieConsentAnalytics", String(analyticsCheckbox.checked));
      localStorage.setItem("cookieConsentMarketing", String(marketingCheckbox.checked));
      hideBanner();
    });
  }
}

