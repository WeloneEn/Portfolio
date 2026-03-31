"use strict";

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCookieBanner();
  initConsentValidation();
  initFadeUp();
});

// ==========================================
// 1. MOBILE MENU
// ==========================================
function initMobileMenu() {
  const btn = document.getElementById("navHamburger");
  const overlay = document.getElementById("mobileOverlay");
  if (!btn || !overlay) return;

  btn.addEventListener("click", () => {
    const isOpen = overlay.classList.contains("open");
    btn.classList.toggle("active", !isOpen);
    overlay.classList.toggle("open", !isOpen);
    document.body.style.overflow = isOpen ? "" : "hidden";
  });

  overlay.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      btn.classList.remove("active");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    });
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("open")) {
      btn.classList.remove("active");
      overlay.classList.remove("open");
      document.body.style.overflow = "";
    }
  });
}

// ==========================================
// 2. COOKIE BANNER (152-ФЗ)
// ==========================================
function initCookieBanner() {
  if (localStorage.getItem("wda_cookies")) return;
  const banner = document.getElementById("cookieBanner");
  if (!banner) return;

  setTimeout(() => banner.classList.add("visible"), 1200);

  const acceptBtn = document.getElementById("cookieAccept");
  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => {
      localStorage.setItem("wda_cookies", "1");
      banner.classList.remove("visible");
      banner.classList.add("hidden");
    });
  }
}

// ==========================================
// 3. CONSENT CHECKBOX (contact form)
// ==========================================
function initConsentValidation() {
  const form = document.getElementById("contactForm");
  if (!form) return;
  const consent = form.querySelector("#consent");
  const submit = form.querySelector('button[type="submit"]');
  if (!consent || !submit) return;

  submit.disabled = !consent.checked;
  consent.addEventListener("change", () => {
    submit.disabled = !consent.checked;
  });
}

// ==========================================
// 4. FADE-UP (Minimal scroll animation via IntersectionObserver)
// ==========================================
function initFadeUp() {
  const els = document.querySelectorAll(".fade-up");
  if (!els.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.transition = "opacity 0.6s ease, transform 0.6s ease";
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

  els.forEach(el => observer.observe(el));
}
