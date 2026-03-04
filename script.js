/**
 * Main Site Script
 * Client-side functionality only (NO ADMIN LOGIC)
 */

"use strict";

// ===== DOM ELEMENTS =====
const preloader = document.getElementById("preloader");
const cursorGlow = document.getElementById("cursorGlow");
const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");
const brandTrigger = document.getElementById("brandTrigger");
const themeToggle = document.getElementById("themeToggle");

// ===== CONSTANTS =====
const VISITOR_STORAGE_KEY = "visitor_id";
const THEME_MODE_KEY = "theme_mode";
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IS_TOUCH_DEVICE = window.matchMedia("(hover: none), (pointer: coarse)").matches;

// ===== IDLE CALLBACK HELPER (INP optimization) =====
const scheduleIdle = (fn) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 50);
  }
};

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
  // --- Critical path (runs immediately for FCP/LCP) ---
  initializeTheme();
  initializeNavigation();
  initializeRevealAnimations();
  hidePreloader();

  // --- Deferred: non-critical enhancements (INP-safe) ---
  scheduleIdle(() => {
    initializeCardTilt();
    initializeCounters();
    initializeSkillScanner();
    initializeSkillBars();
    initializeCustomSelect();
    initializeProjectFilters();
    initializeClickableTiles();
  });

  // --- Deferred: visual candy (lowest priority) ---
  scheduleIdle(() => {
    initDynamicGlare();
    initKineticScroll();
    initializeMagneticButtons();
    initializeBrandAnimation();
  });

  // --- Facade: visitor tracking deferred until scroll ---
  let _trackingInitialized = false;
  const initTrackingOnce = () => {
    if (_trackingInitialized) return;
    _trackingInitialized = true;
    window.removeEventListener('scroll', _onScrollTrack);
    initializeVisitorTracking();
  };
  const _onScrollTrack = () => {
    if (window.scrollY > 100) initTrackingOnce();
  };
  window.addEventListener('scroll', _onScrollTrack, { passive: true });
  // Fallback: init after 5s even without scroll
  setTimeout(initTrackingOnce, 5000);
});

// ===== BRAND COLLAPSE ANIMATION =====
function initializeBrandAnimation() {
  const brand = document.getElementById("brandTrigger");
  if (!brand || REDUCED_MOTION) return;

  setTimeout(() => {
    brand.classList.add("is-collapsed");
  }, 2500);

  brand.addEventListener("mouseenter", () => {
    brand.classList.remove("is-collapsed");
  });

  brand.addEventListener("mouseleave", () => {
    setTimeout(() => {
      brand.classList.add("is-collapsed");
    }, 800);
  });
}

// ===== REVEAL ANIMATIONS =====
function initializeRevealAnimations() {
  const revealEls = document.querySelectorAll(".reveal");
  if (!revealEls.length) return;

  if (REDUCED_MOTION) {
    revealEls.forEach(el => el.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => observer.observe(el));
}

// ===== THEME SYSTEM =====
function initializeTheme() {
  const savedTheme = localStorage.getItem(THEME_MODE_KEY) || "light";
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener("click", toggleTheme);
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.setAttribute("data-theme", theme);
  document.body.classList.toggle("dark-mode", isDark);

  if (themeToggle) {
    let iconSpan = themeToggle.querySelector('.theme-toggle__icon');
    let textSpan = themeToggle.querySelector('.theme-toggle__text');

    if (!iconSpan || !textSpan) {
      themeToggle.innerHTML = '<span class="theme-toggle__icon"></span><span class="theme-toggle__text"></span>';
      iconSpan = themeToggle.querySelector('.theme-toggle__icon');
      textSpan = themeToggle.querySelector('.theme-toggle__text');
    }

    // Update text and icon to reflect the CURRENT status, so Light Mode = "Светлая", Dark Mode = "Тёмная" (hidden by CSS so only ☾ remains)
    iconSpan.textContent = isDark ? "☾" : "☀";
    textSpan.textContent = isDark ? "Тёмная" : "Светлая";
  }
}

function toggleTheme() {
  const currentTheme = localStorage.getItem(THEME_MODE_KEY) || "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_MODE_KEY, newTheme);
  applyTheme(newTheme);
}

// ===== NAVIGATION =====
function initializeNavigation() {
  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", toggleMenu);
    siteNav.addEventListener("click", () => closeMenu());
  }
}

function toggleMenu() {
  if (!siteNav) return;
  const isOpen = siteNav.classList.contains("is-open");
  if (isOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}

function openMenu() {
  if (!siteNav || !menuToggle) return;
  siteNav.classList.add("is-open");
  document.body.classList.add("menu-open");
  menuToggle.textContent = "Close";
  menuToggle.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  if (!siteNav || !menuToggle) return;
  siteNav.classList.remove("is-open");
  document.body.classList.remove("menu-open");
  menuToggle.textContent = "Menu";
  menuToggle.setAttribute("aria-expanded", "false");
}

// ===== CURSOR GLOW (optional) =====
if (cursorGlow && !IS_TOUCH_DEVICE && !REDUCED_MOTION) {
  document.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = e.clientX + "px";
    cursorGlow.style.top = e.clientY + "px";
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


// ===== SCROLL-BOUND KINETIC TYPOGRAPHY (2026 Trend) =====
function initKineticScroll() {
  const textEl = document.getElementById('kinetic-text');
  if (!textEl || REDUCED_MOTION || IS_TOUCH_DEVICE) return;

  // We duplicate the text infinitely to prevent running out of words
  textEl.innerHTML += textEl.innerHTML;
  
  let currentScroll = window.scrollY;
  let targetScroll = window.scrollY;
  let ease = 0.08;

  function runKinetic() {
    // Determine scroll direction and velocity
    targetScroll = window.scrollY;
    
    // Lerp (Linear Interpolation) for buttery smooth kinetic movement
    currentScroll += (targetScroll - currentScroll) * ease;
    
    // Calculate translate X and arbitrary velocity Skew
    const velocity = targetScroll - currentScroll;
    const skew = Math.max(-15, Math.min(15, velocity * -0.2)); 
    
    // Negative currentScroll moves it left. Add offset to start somewhat centered
    const translateX = -(currentScroll * 0.8) % (textEl.scrollWidth / 2);

    // Apply hardware accelerated transform
    textEl.style.transform = `translate3d(${translateX}px, 0, 0) skewX(${skew}deg)`;

    requestAnimationFrame(runKinetic);
  }

  requestAnimationFrame(runKinetic);
}

// ===== PRELOADER =====
function hidePreloader() {
  if (preloader) {
    preloader.style.opacity = "0";
    preloader.style.pointerEvents = "none";
  }
}

// ===== VISITOR TRACKING =====
function initializeVisitorTracking() {
  const visitorId = localStorage.getItem(VISITOR_STORAGE_KEY) || generateVisitorId();
  localStorage.setItem(VISITOR_STORAGE_KEY, visitorId);

  // Track current page view
  trackPageView();
}

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

// ===== 3D CARD TILT =====
function initializeCardTilt() {
  if (IS_TOUCH_DEVICE || REDUCED_MOTION) return;
  const cards = document.querySelectorAll(".tilt, .project-card, .card, .metrics article, .timeline__grid article");
  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -6;
      const rotateY = ((x - centerX) / centerX) * 6;
      card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
      card.style.transition = "transform 0.1s ease-out";
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
      card.style.transition = "transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1)";
    });
  });
}

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
  const buttons = document.querySelectorAll(".btn--primary, .btn--ghost");
  buttons.forEach(btn => {
    btn.addEventListener("mousemove", (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translate(${x * 0.15}px, ${y * 0.2}px) translateY(-2px)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.transform = "";
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

// ===== PROJECT FILTERS =====
function initializeProjectFilters() {
  const filtersContainer = document.getElementById("filters");
  const projectsList = document.getElementById("projectsList");
  const statusEl = document.getElementById("projectFilterStatus");
  const jumpBtn = document.getElementById("filtersJump");

  if (!filtersContainer || !projectsList) return;

  const filterBtns = filtersContainer.querySelectorAll("[data-filter]");
  const cards = projectsList.querySelectorAll(".project-card[data-category]");

  filterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.dataset.filter;

      // Update active button
      filterBtns.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      // Filter cards with animation
      let shown = 0;
      cards.forEach(card => {
        const match = filter === "all" || card.dataset.category === filter;
        if (match) {
          card.classList.remove("is-hidden");
          card.style.opacity = "0";
          card.style.transform = "translateY(12px)";
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              card.style.transition = "opacity 0.35s ease, transform 0.35s ease";
              card.style.opacity = "1";
              card.style.transform = "translateY(0)";
            });
          });
          shown++;
        } else {
          card.classList.add("is-hidden");
        }
      });

      // Update status text
      if (statusEl) {
        const labels = { all: "все проекты", version: "версии", final: "финальные", special: "специальные" };
        statusEl.textContent = filter === "all"
          ? `Показаны все проекты (${shown}).`
          : `Показаны ${labels[filter] || filter} (${shown}).`;
      }
    });
  });

  // Jump to filters button
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      filtersContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
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

// ===== CURSOR GLOW =====
function initializeCursorGlow() {
  if (IS_TOUCH_DEVICE || REDUCED_MOTION || !cursorGlow) return;

  let mouseX = 0, mouseY = 0;
  let glowX = 0, glowY = 0;

  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function animateGlow() {
    glowX += (mouseX - glowX) * 0.12;
    glowY += (mouseY - glowY) * 0.12;
    cursorGlow.style.left = glowX + "px";
    cursorGlow.style.top = glowY + "px";
    requestAnimationFrame(animateGlow);
  }
  animateGlow();
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


// ===== CONTACT FORM ANIMATION =====
// ===== INLINE FORM VALIDATION (Epic 4) =====
function validateField(field) {
  const errorEl = field.getAttribute('aria-describedby')
    ? document.getElementById(field.getAttribute('aria-describedby'))
    : null;
  let message = '';

  // Check validity
  if (field.required && !field.value.trim()) {
    message = 'Обязательное поле';
  } else if (field.minLength > 0 && field.value.trim().length < field.minLength) {
    message = 'Минимум ' + field.minLength + ' символов';
  } else if (field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
    message = 'Некорректный email';
  }

  // Update UI
  if (message) {
    field.classList.add('is-invalid');
    if (errorEl) errorEl.textContent = message;
    return false;
  } else {
    field.classList.remove('is-invalid');
    if (errorEl) errorEl.textContent = '';
    return true;
  }
}

function initInlineValidation() {
  const form = document.querySelector('.contact-form');
  if (!form) return;

  const fields = form.querySelectorAll('input:not([type="hidden"]), textarea');
  fields.forEach(field => {
    // Validate on blur (when user leaves the field)
    field.addEventListener('blur', () => validateField(field));

    // Clear error as user types (only if already marked invalid)
    field.addEventListener('input', () => {
      if (field.classList.contains('is-invalid')) {
        validateField(field);
      }
    });
  });
}

// ===== CONTACT FORM ANIMATION (Enhanced with validation + spinner) =====
function initializeContactForm() {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  // Initialize inline validation
  initInlineValidation();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const note = form.querySelector(".form-note");

    // Validate all fields before submit
    const fields = form.querySelectorAll('input:not([type="hidden"]), textarea');
    let isValid = true;
    fields.forEach(field => {
      if (!validateField(field)) isValid = false;
    });

    // Check consent checkbox if present
    const consent = form.querySelector('#consentCheck');
    if (consent && !consent.checked) {
      isValid = false;
      const consentError = consent.closest('.consent-field');
      if (consentError) {
        consentError.classList.add('has-error');
        // Clear error when user checks
        consent.addEventListener('change', () => {
          consentError.classList.remove('has-error');
        }, { once: true });
      }
    }

    if (!isValid) {
      // Focus the first invalid field
      const firstInvalid = form.querySelector('.is-invalid, #consentCheck:not(:checked)');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    // === SUBMIT: Set loading state + disable button ===
    btn.disabled = true;
    btn.classList.add("is-loading");
    if (note) {
      note.textContent = "";
      note.className = "form-note";
    }

    // Simulate network request
    setTimeout(() => {
      btn.classList.remove("is-loading");
      btn.disabled = false;
      if (note) {
        note.textContent = "\u2705 Заявка успешно отправлена! Мы свяжемся с вами в ближайшее время.";
        note.classList.add("success");
      }
      form.reset();

      // Clear all error states
      form.querySelectorAll('.is-invalid').forEach(f => f.classList.remove('is-invalid'));
      form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });

      // Clear success message after 5 seconds
      setTimeout(() => {
        if (note && note.classList.contains("success")) {
          note.textContent = "";
          note.className = "form-note";
        }
      }, 5000);
    }, 1500);
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

