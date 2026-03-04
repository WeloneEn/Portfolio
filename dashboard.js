/**
 * Owner Dashboard
 * Управление системой и пользователями
 */

"use strict";

// ===== DOM ELEMENTS =====
const dashboardTitle = document.getElementById("dashboardTitle");
const actorName = document.getElementById("actorName");
const actorRole = document.getElementById("actorRole");
const logoutBtn = document.getElementById("logoutBtn");
const errorMessage = document.getElementById("errorMessage");
const totalUsers = document.getElementById("totalUsers");
const totalProducts = document.getElementById("totalProducts");
const totalManagers = document.getElementById("totalManagers");
const usersList = document.getElementById("usersList");
const createUserBtn = document.getElementById("createUserBtn");

let currentActor = null;

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", () => {
  initializeLogout();
  loadDashboard();
});

// ===== MAIN DASHBOARD LOAD =====
async function loadDashboard() {
  try {
    const token = localStorage.getItem("adminToken");
    
    if (!token) {
      redirectToLogin();
      return;
    }

    // Parse token to get actor info (in real app, call /api/admin/me endpoint)
    const actor = JSON.parse(localStorage.getItem("adminActor") || "{}");
    
    if (!actor.id || actor.role !== "owner") {
      redirectToLogin();
      return;
    }

    currentActor = actor;
    updateHeader(actor);
    loadUsers(token);
  } catch (error) {
    console.error("Dashboard load error:", error);
    showError("Ошибка загрузки: " + error.message);
  }
}

// ===== UPDATE HEADER =====
function updateHeader(actor) {
  dashboardTitle.textContent = `Здравствуйте, ${actor.name || "Owner"}!`;
  actorName.textContent = actor.name || actor.username || "—";
  actorRole.textContent = "Владелец системы";
}

// ===== LOAD USERS =====
async function loadUsers(token) {
  try {
    const response = await fetch(getApiUrl("/api/admin/users"), {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.status === 401) {
      localStorage.removeItem("adminToken");
      redirectToLogin();
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const users = data.users || [];

    // Update stats
    updateStats(users);

    // Render users list
    renderUsersList(users);
  } catch (error) {
    console.error("Load users error:", error);
    showError("Ошибка загрузки пользователей: " + error.message);
  }
}

// ===== UPDATE STATS =====
function updateStats(users) {
  const ownerCount = users.filter((u) => u.role === "owner").length;
  const productCount = users.filter((u) => u.role === "product").length;
  const managerCount = users.filter((u) => u.role === "manager").length;

  totalUsers.textContent = users.length;
  totalProducts.textContent = productCount;
  totalManagers.textContent = managerCount;
}

// ===== RENDER USERS LIST =====
function renderUsersList(users) {
  if (!users || users.length === 0) {
    usersList.innerHTML = "<div class='loading'>Пользователей не найдено</div>";
    return;
  }

  usersList.innerHTML = users
    .map(
      (user) => `
    <div class="user-item">
      <div class="info">
        <div class="name">${escapeHtml(user.name || user.username)}</div>
        <div class="role">
          ID: ${escapeHtml(user.id)} • 
          Department: ${escapeHtml(user.department || "—")}
        </div>
      </div>
      <span class="badge ${user.role}">
        ${getRoleLabel(user.role)}
      </span>
    </div>
  `
    )
    .join("");
}

// ===== UTILITY FUNCTIONS =====
function getRoleLabel(role) {
  const labels = {
    owner: "👑 Owner",
    product: "🎯 Product",
    manager: "📚 Manager"
  };
  return labels[role] || role;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  if (errorMessage) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
  }
}

function getApiUrl(pathname) {
  const base = window.location.origin;
  return `${base}${pathname}`;
}

// ===== LOGOUT HANDLER =====
function initializeLogout() {
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("adminToken");
      localStorage.removeItem("adminActor");
      window.location.href = "/index.html";
    });
  }
}

function redirectToLogin() {
  window.location.href = "/index.html";
}
