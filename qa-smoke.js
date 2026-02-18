"use strict";

const fs = require("fs/promises");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "data", "site-data.json");

const QA_PORT = Number(process.env.QA_PORT || 3199);
const QA_ADMIN_PASSWORD =
  process.env.QA_ADMIN_PASSWORD || `qa_password_${Date.now()}`;
const QA_ADMIN_USERNAME =
  process.env.QA_ADMIN_USERNAME || "admin";
const QA_TOKEN_SECRET =
  process.env.QA_TOKEN_SECRET ||
  `qa_token_secret_${Date.now()}_${Math.random().toString(16).slice(2)}`;
const QA_HELP_LOGIN = process.env.QA_HELP_LOGIN || "sales_help";
const QA_HELP_PASSWORD =
  process.env.QA_HELP_PASSWORD || "change-sales-help";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function request({
  method = "GET",
  pathname,
  body,
  token,
  expectedStatus,
  timeoutMs = 6000
}) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;

    const req = http.request(
      {
        hostname: "localhost",
        port: QA_PORT,
        path: pathname,
        method,
        headers: {
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }

          if (
            expectedStatus !== undefined &&
            Number(res.statusCode) !== Number(expectedStatus)
          ) {
            reject(
              new Error(
                `HTTP ${res.statusCode} for ${method} ${pathname}. Expected ${expectedStatus}. Body: ${text}`
              )
            );
            return;
          }

          resolve({
            status: Number(res.statusCode),
            text,
            json
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout for ${method} ${pathname}`));
    });
    req.on("error", reject);

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function waitForServer(maxAttempts = 40) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await request({
        method: "GET",
        pathname: "/api/health",
        expectedStatus: 200,
        timeoutMs: 1200
      });

      if (response.json && response.json.ok === true) {
        return;
      }
    } catch {
      // Retry until max attempts.
    }

    await sleep(200);
  }

  throw new Error("Server did not start in time.");
}

async function readDataBackup() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return {
      hadFile: true,
      raw
    };
  } catch {
    return {
      hadFile: false,
      raw: ""
    };
  }
}

async function restoreDataBackup(backup) {
  if (!backup) {
    return;
  }

  if (backup.hadFile) {
    await fs.writeFile(DATA_FILE, backup.raw, "utf8");
    return;
  }

  try {
    await fs.unlink(DATA_FILE);
  } catch {
    // Ignore if file does not exist.
  }
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) {
    return;
  }

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        serverProcess.kill("SIGKILL");
      } catch {
        // Ignore kill errors.
      }
      resolve();
    }, 2000);

    serverProcess.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });

    try {
      serverProcess.kill();
    } catch {
      clearTimeout(timer);
      resolve();
    }
  });
}

async function run() {
  const backup = await readDataBackup();
  let serverProcess = null;

  try {
    serverProcess = spawn(process.execPath, ["server.js"], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        PORT: String(QA_PORT),
        ADMIN_PASSWORD: QA_ADMIN_PASSWORD,
        TOKEN_SECRET: QA_TOKEN_SECRET
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    await waitForServer();
    console.log("OK: /api/health");

    const pages = [
      "/",
      "/index.html",
      "/about.html",
      "/projects.html",
      "/contact.html",
      "/admin.html",
      "/admin-leads.html"
    ];

    for (const page of pages) {
      const pageResponse = await request({
        method: "GET",
        pathname: page,
        expectedStatus: 200
      });
      assert(
        pageResponse.text.toLowerCase().includes("<!doctype html>"),
        `Page ${page} does not look like HTML.`
      );
    }
    console.log("OK: static pages");

    const visitorId = `qa_visitor_${Date.now()}`;
    const visit = await request({
      method: "POST",
      pathname: "/api/visit",
      body: {
        visitorId,
        path: "/index.html",
        referrer: "qa-smoke",
        userAgent: "qa-smoke-script"
      },
      expectedStatus: 201
    });
    assert(visit.json && visit.json.ok === true, "Failed: /api/visit");
    console.log("OK: /api/visit");

    const engagement = await request({
      method: "POST",
      pathname: "/api/engagement",
      body: {
        visitorId,
        path: "/index.html",
        durationMs: 42000
      },
      expectedStatus: 201
    });
    assert(engagement.json && engagement.json.ok === true, "Failed: /api/engagement");
    console.log("OK: /api/engagement");

    const secret = await request({
      method: "POST",
      pathname: "/api/secret",
      body: {
        visitorId,
        path: "/index.html",
        secret: "qa-smoke-secret"
      },
      expectedStatus: 201
    });
    assert(secret.json && secret.json.ok === true, "Failed: /api/secret");
    console.log("OK: /api/secret");

    const lead = await request({
      method: "POST",
      pathname: "/api/leads",
      body: {
        name: "QA Smoke User",
        contact: "qa-smoke@example.com",
        type: "Landing",
        message: "Smoke test",
        sourcePage: "/contact.html"
      },
      expectedStatus: 201
    });
    assert(
      lead.json && typeof lead.json.leadId === "string" && lead.json.leadId.length > 0,
      "Failed: /api/leads did not return leadId"
    );
    const leadId = lead.json.leadId;
    console.log("OK: /api/leads");

    const stats = await request({
      method: "GET",
      pathname: "/api/admin/stats",
      expectedStatus: 200
    });
    assert(
      stats.json &&
        Number.isFinite(Number(stats.json.totalHits)) &&
        Number.isFinite(Number(stats.json.todayUniqueVisitors)) &&
        Number.isFinite(Number(stats.json.todayRepeatVisits)) &&
        Number.isFinite(Number(stats.json.avgViewMs)) &&
        Number.isFinite(Number(stats.json.secretFindsTotal)) &&
        Number.isFinite(Number(stats.json.leadsTotal)),
      "Failed: stats payload"
    );
    console.log("OK: /api/admin/stats (public workspace)");

    const team = await request({
      method: "GET",
      pathname: "/api/admin/team",
      expectedStatus: 200
    });
    assert(
      team.json &&
        team.json.ok === true &&
        team.json.actor &&
        team.json.actor.role === "owner" &&
        Array.isArray(team.json.users) &&
        team.json.users.length > 0 &&
        Array.isArray(team.json.departments) &&
        team.json.departments.length > 0,
      "Failed: /api/admin/team payload"
    );
    console.log("OK: /api/admin/team (public workspace)");

    const leads = await request({
      method: "GET",
      pathname: "/api/admin/leads?limit=5000",
      expectedStatus: 200
    });
    assert(
      leads.json &&
        Array.isArray(leads.json.leads) &&
        Number.isFinite(Number(leads.json.total)),
      "Failed: leads payload"
    );
    const foundLead = leads.json.leads.find((item) => item.id === leadId);
    assert(Boolean(foundLead), "Created lead is not found in admin list");
    console.log("OK: /api/admin/leads (public workspace)");

    const patch = await request({
      method: "PATCH",
      pathname: `/api/admin/leads/${encodeURIComponent(leadId)}`,
      body: { status: "done", internalNote: "QA open workspace update" },
      expectedStatus: 200
    });
    assert(
      patch.json &&
        patch.json.ok === true &&
        patch.json.lead &&
        patch.json.lead.status === "done",
      "Failed: PATCH /api/admin/leads/:id (public workspace)"
    );
    console.log("OK: PATCH /api/admin/leads/:id (public workspace)");

    await request({
      method: "GET",
      pathname: "/api/admin/users",
      expectedStatus: 401
    });
    console.log("OK: /api/admin/users is still protected");

    console.log("");
    console.log("SMOKE TEST PASSED");
    console.log(`Port: ${QA_PORT}`);
  } finally {
    await stopServer(serverProcess);
    await restoreDataBackup(backup);
  }
}

run().catch((error) => {
  console.error("");
  console.error("SMOKE TEST FAILED");
  console.error(error && error.message ? error.message : error);
  process.exitCode = 1;
});
