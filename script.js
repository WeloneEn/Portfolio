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

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
  initializeTheme();
  initializeNavigation();
  initializeVisitorTracking();
  initializeRevealAnimations();
  initializeCardTilt();
  initializeCounters();
  initializeSkillScanner();
  initializeMagneticButtons();
  initializeBrandAnimation();
  hidePreloader();
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
    themeToggle.textContent = isDark ? "☀ Светлая" : "☾ Тёмная";
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
  const isOpen = siteNav.classList.contains("nav-open");
  if (isOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}

function openMenu() {
  if (!siteNav || !menuToggle) return;
  siteNav.classList.add("nav-open");
  menuToggle.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  if (!siteNav || !menuToggle) return;
  siteNav.classList.remove("nav-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

// ===== CURSOR GLOW (optional) =====
if (cursorGlow && !IS_TOUCH_DEVICE && !REDUCED_MOTION) {
  document.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = e.clientX + "px";
    cursorGlow.style.top = e.clientY + "px";
  });
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
