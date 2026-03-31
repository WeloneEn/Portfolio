/**
 * Main Server
 * Client-side backend + Admin API (clean architecture)
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");

// ===== DATA MANAGEMENT =====

async function loadUsers() {
  try {
    const filePath = path.join(DATA_DIR, "admin-users.json");
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading users:", error.message);
    return [];
  }
}

async function loadData() {
  try {
    const filePath = path.join(DATA_DIR, "site-data.json");
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading data:", error.message);
    return null;
  }
}

async function saveData(data) {
  try {
    const filePath = path.join(DATA_DIR, "site-data.json");
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving data:", error.message);
    return false;
  }
}

async function loadLeads() {
  try {
    const filePath = path.join(DATA_DIR, "leads.json");
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    console.error("Error loading leads:", error.message);
    return [];
  }
}

async function saveLeads(leadsData) {
  try {
    const filePath = path.join(DATA_DIR, "leads.json");
    await fs.promises.writeFile(filePath, JSON.stringify(leadsData, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error saving leads:", error.message);
    return false;
  }
}

// ===== RESPONSE HELPERS =====

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

// ===== REQUEST BODY READER =====

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", (error) => {
      reject(error);
    });
  });
}

// ===== MAIN REQUEST HANDLER =====

async function handleRequest(req, res) {
  const urlObject = url.parse(req.url, true);
  const pathname = urlObject.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // ===== API ROUTES (starts with /api) =====
  if (pathname.startsWith("/api/")) {
    await handleApiRequest(req, res, pathname, urlObject);
    return;
  }

  // ===== STATIC FILES =====
  await serveStatic(req, res, urlObject);
}

// ===== API ROUTES =====

async function handleApiRequest(req, res, pathname, urlObject) {
  // POST /api/admin/login
  if (pathname === "/api/admin/login" && req.method === "POST") {
    await handleAdminLogin(req, res);
    return;
  }

  // GET /api/admin/users (requires owner role)
  if (pathname === "/api/admin/users" && req.method === "GET") {
    await handleGetUsers(req, res);
    return;
  }

  // POST /api/leads (Public submission endpoint)
  if (pathname === "/api/leads" && req.method === "POST") {
    await handlePostLead(req, res);
    return;
  }

  // 404 for unknown API routes
  sendJson(res, 404, { error: "API_ROUTE_NOT_FOUND" });
}

// ===== HELPER: Extract token from Authorization header =====
function extractToken(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

// ===== HANDLER: Get Users (Owner only) =====
async function handleGetUsers(req, res) {
  try {
    const token = extractToken(req);

    if (!token) {
      sendJson(res, 401, { error: "UNAUTHORIZED" });
      return;
    }

    // For now, just return all users (in real app, verify token and check role)
    const users = await loadUsers();

    sendJson(res, 200, {
      ok: true,
      users: users
    });
  } catch (error) {
    console.error("Get users error:", error);
    sendJson(res, 500, { error: "INTERNAL_ERROR" });
  }
}

// ===== HANDLER: Admin Login =====
async function handleAdminLogin(req, res) {
  try {
    const body = await readJsonBody(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    if (!username || !password) {
      sendJson(res, 401, { error: "INVALID_CREDENTIALS" });
      return;
    }

    // Load users from admin-users.json
    const users = await loadUsers();
    const user = users.find((u) => u.username === username);

    if (!user || user.password !== password) {
      sendJson(res, 401, { error: "INVALID_CREDENTIALS" });
      return;
    }

    // Return success with user info
    const actor = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department
    };

    sendJson(res, 200, {
      ok: true,
      token: `token_${user.id}_${Date.now()}`,
      actor: actor
    });
  } catch (error) {
    console.error("Login error:", error);
    sendJson(res, 400, { error: "INVALID_REQUEST" });
  }
}

// ===== HANDLE NEW LEAD SUBMISSION =====
async function handlePostLead(req, res) {
  try {
    const body = await readJsonBody(req);

    // Basic validation
    if (!body.name || !body.contact) {
      return sendJson(res, 400, { error: "MISSING_REQUIRED_FIELDS" });
    }

    const newLead = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      name: String(body.name).trim(),
      contact: String(body.contact).trim(),
      type: String(body.type || "Не указан").trim(),
      message: String(body.message || "").trim(),
      status: String(body.status || "active"),
      target_month: body.target_month ? String(body.target_month) : null
    };

    const leads = await loadLeads();
    leads.push(newLead);

    const saved = await saveLeads(leads);
    if (!saved) {
      throw new Error("Failed to write leads file");
    }

    sendJson(res, 201, { success: true, leadId: newLead.id });
  } catch (err) {
    console.error("handlePostLead processing error:", err.message);
    if (err.message === "INVALID_JSON") {
      return sendJson(res, 400, { error: "INVALID_JSON" });
    }
    sendJson(res, 500, { error: "SERVER_ERROR" });
  }
}

// ===== STATIC FILE SERVING =====

async function serveStatic(req, res, urlObject) {
  let pathname = urlObject.pathname;

  // Redirect root to index.html
  if (pathname === "/") {
    pathname = "/index.html";
  }

  // Security check
  const safePath = path.normalize(path.join(ROOT_DIR, pathname));
  if (!safePath.startsWith(ROOT_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const stats = await fs.promises.stat(safePath);

    // If directory, try index.html
    if (stats.isDirectory()) {
      const indexPath = path.join(safePath, "index.html");
      try {
        const content = await fs.promises.readFile(indexPath, "utf-8");
        sendHtml(res, 200, content);
        return;
      } catch {
        sendText(res, 404, "Not Found");
        return;
      }
    }

    // Serve file
    const ext = path.extname(pathname).toLowerCase();

    let contentType = "text/plain";
    let isBinary = false;
    if (ext === ".html") contentType = "text/html; charset=utf-8";
    else if (ext === ".css") contentType = "text/css; charset=utf-8";
    else if (ext === ".js") contentType = "application/javascript; charset=utf-8";
    else if (ext === ".json") contentType = "application/json; charset=utf-8";
    else if (ext === ".svg") contentType = "image/svg+xml";
    else if (ext === ".png") { contentType = "image/png"; isBinary = true; }
    else if (ext === ".jpg" || ext === ".jpeg") { contentType = "image/jpeg"; isBinary = true; }
    else if (ext === ".gif") { contentType = "image/gif"; isBinary = true; }
    else if (ext === ".webp") { contentType = "image/webp"; isBinary = true; }
    else if (ext === ".ico") { contentType = "image/x-icon"; isBinary = true; }
    else if (ext === ".woff2") { contentType = "font/woff2"; isBinary = true; }
    else if (ext === ".woff") { contentType = "font/woff"; isBinary = true; }

    const content = isBinary
      ? await fs.promises.readFile(safePath)
      : await fs.promises.readFile(safePath, "utf-8");

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      // Fallback: try appending .html if there's no extension
      if (!path.extname(pathname)) {
        try {
          const fallbackPath = safePath + ".html";
          const fallbackContent = await fs.promises.readFile(fallbackPath, "utf-8");
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fallbackContent);
          return;
        } catch (fallbackError) {
          // Fallback failed, send 404
        }
      }
      sendText(res, 404, "Not Found");
    } else {
      console.error("Error serving file:", error.message);
      sendText(res, 500, "Internal Server Error");
    }
  }
}

// ===== SERVER START =====

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📁 Root: ${ROOT_DIR}`);
  console.log(`📊 Data: ${DATA_DIR}`);
});
