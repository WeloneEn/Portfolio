"use strict";

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initCookieBanner();
  initConsentValidation();
  initScrollReveal();
  initMagneticButtons();
  initHeroCounter();
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

  setTimeout(() => banner.classList.add("visible"), 1500);

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
  const hint = document.getElementById("formHint");
  if (!consent || !submit) return;

  submit.disabled = !consent.checked;

  consent.addEventListener("change", () => {
    submit.disabled = !consent.checked;
    if (hint) {
      hint.style.display = consent.checked ? "none" : "";
    }
  });
}

// ==========================================
// 4. SCROLL REVEAL — Aggressive cascading animations
// ==========================================
function initScrollReveal() {
  const animatedElements = document.querySelectorAll(
    ".fade-up, .slide-in-left, .slide-in-right, .scale-in, .clip-reveal"
  );

  if (!animatedElements.length) return;

  // Determine animation durations based on type
  const getDuration = (el) => {
    if (el.classList.contains("clip-reveal")) return "0.9s";
    if (el.classList.contains("scale-in")) return "0.8s";
    if (el.classList.contains("slide-in-left") || el.classList.contains("slide-in-right")) return "0.7s";
    return "0.65s";
  };

  const getEasing = (el) => {
    if (el.classList.contains("clip-reveal")) return "cubic-bezier(0.16, 1, 0.3, 1)";
    if (el.classList.contains("scale-in")) return "cubic-bezier(0.34, 1.56, 0.64, 1)";
    return "cubic-bezier(0.16, 1, 0.3, 1)";
  };

  const revealElement = (el) => {
    const duration = getDuration(el);
    const easing = getEasing(el);

    if (!el.classList.contains("clip-reveal")) {
      el.style.transition = `opacity ${duration} ${easing}, transform ${duration} ${easing}`;
    }

    requestAnimationFrame(() => {
      el.classList.add("is-visible");
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          revealElement(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.05,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  // Observe all animated elements; elements already in viewport
  // will trigger immediately on the first observer callback
  animatedElements.forEach((el) => observer.observe(el));

  // Safety net: reveal any elements that are already above-the-fold
  // after a short delay (covers edge cases where observer misses them)
  setTimeout(() => {
    animatedElements.forEach((el) => {
      if (el.classList.contains("is-visible")) return;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.85) {
        revealElement(el);
        observer.unobserve(el);
      }
    });
  }, 100);
}

// ==========================================
// 5. MAGNETIC BUTTON EFFECT
// ==========================================
function initMagneticButtons() {
  const wraps = document.querySelectorAll(".magnetic-wrap");
  if (!wraps.length || window.matchMedia("(pointer: coarse)").matches) return;

  wraps.forEach((wrap) => {
    const btn = wrap.firstElementChild;
    if (!btn) return;

    const strength = 0.3;
    const resetSpeed = "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)";

    wrap.addEventListener("mousemove", (e) => {
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;

      btn.style.transition = "transform 0.15s ease-out";
      btn.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
    });

    wrap.addEventListener("mouseleave", () => {
      btn.style.transition = resetSpeed;
      btn.style.transform = "translate(0, 0)";
    });
  });
}

// ==========================================
// 6. HERO COUNTER — Animate numbers on load
// ==========================================
function initHeroCounter() {
  const counters = document.querySelectorAll(".status-item__value--accent");
  if (!counters.length) return;

  // Simple reveal — stagger the status items
  const statusItems = document.querySelectorAll(".status-item");
  statusItems.forEach((item, i) => {
    item.style.opacity = "0";
    item.style.transform = "translateX(10px)";
    item.style.transition = `opacity 0.5s ease ${0.3 + i * 0.12}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.12}s`;
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const items = entry.target.querySelectorAll(".status-item");
          items.forEach((item) => {
            item.style.opacity = "1";
            item.style.transform = "translateX(0)";
          });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.3 }
  );

  const statusCard = document.querySelector(".hero__status-card");
  if (statusCard) observer.observe(statusCard);
}
