"use strict";

const fs = require("fs/promises");
const path = require("path");
const http = require("http");
const { spawn, spawnSync } = require("child_process");

const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "data", "site-data.json");
const ADMIN_USERS_FILE = path.join(ROOT_DIR, "data", "admin-users.json");

const QA_PORT = Number(process.env.QA_PORT || 3199);
const QA_ADMIN_PASSWORD =
  process.env.QA_ADMIN_PASSWORD || `qa_password_${Date.now()}`;
const QA_ADMIN_USERNAME =
  process.env.QA_ADMIN_USERNAME || "admin";
const QA_TOKEN_SECRET =
  process.env.QA_TOKEN_SECRET ||
  `qa_token_secret_${Date.now()}_${Math.random().toString(16).slice(2)}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, marker, message) {
  assert(String(text || "").includes(String(marker || "")), message);
}

function runNodeCheck(filePath) {
  const result = spawnSync(process.execPath, ["--check", filePath], {
    cwd: ROOT_DIR,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(
      `Syntax check failed for ${filePath}: ${result.stderr || result.stdout || "unknown error"}`
    );
  }
}

function verifyThemeCoverage(styleText) {
  const requiredSelectors = [
    "body.light-mode .event-card",
    "body.future-mode .event-card",
    "body.light-mode .training-summary__item",
    "body.future-mode .training-summary__item",
    "body.light-mode .training-profile-meta",
    "body.future-mode .training-profile-meta",
    "body.light-mode .training-review-item",
    "body.future-mode .training-review-item"
  ];

  requiredSelectors.forEach((selector) => {
    assertIncludes(styleText, selector, `Missing theme selector: ${selector}`);
  });
}

function verifyAdminUiCoverage(adminUiText) {
  const requiredSelectors = [
    'body[data-page="admin"] .site-header',
    'body[data-page="admin"] .leads-filters',
    'body[data-page="admin"] .lead-item',
    'body[data-page="admin"] .event-card',
    'body[data-page="admin"] .training-layout'
  ];

  requiredSelectors.forEach((selector) => {
    assertIncludes(adminUiText, selector, `Missing admin-ui selector: ${selector}`);
  });
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

async function readFileBackup(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
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

async function restoreFileBackup(filePath, backup) {
  if (!backup) {
    return;
  }

  if (backup.hadFile) {
    await fs.writeFile(filePath, backup.raw, "utf8");
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore if file does not exist.
  }
}

async function readDataBackup() {
  return {
    siteData: await readFileBackup(DATA_FILE),
    adminUsers: await readFileBackup(ADMIN_USERS_FILE)
  };
}

async function restoreDataBackup(backup) {
  if (!backup) {
    return;
  }

  await restoreFileBackup(DATA_FILE, backup.siteData);
  await restoreFileBackup(ADMIN_USERS_FILE, backup.adminUsers);
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

    const scriptChecks = [
      "server.js",
      "script.js",
      "admin.js",
      "admin-leads.js",
      "admin-events.js",
      "admin-training.js"
    ];
    scriptChecks.forEach((filePath) => runNodeCheck(filePath));
    console.log("OK: syntax checks");

    const pages = [
      "/",
      "/index.html",
      "/about.html",
      "/projects.html",
      "/contact.html",
      "/admin.html",
      "/admin-leads.html",
      "/admin-events.html",
      "/admin-training.html",
      "/admin-events",
      "/admin-training"
    ];

    const pageMarkers = {
      "/admin.html": [
        'id="adminPanel"',
        "admin-ui.css",
        'href="admin-leads.html"',
        'href="admin-events.html"',
        'href="admin-training.html"'
      ],
      "/admin-leads.html": [
        'id="leadsPanel"',
        'id="leadsList"',
        'id="leadStatusFilter"',
        'id="leadPriorityFilter"',
        "admin-ui.css",
        'href="admin-events.html"',
        'href="admin-training.html"'
      ],
      "/admin-events.html": [
        'id="eventsPanel"',
        'id="eventsList"',
        "admin-ui.css",
        'href="admin-leads.html"',
        'href="admin-training.html"'
      ],
      "/admin-training.html": [
        'id="trainingPanel"',
        'id="trainingReviewForm"',
        'id="trainingUserSelect"',
        "admin-ui.css",
        'href="admin-events.html"',
        'href="admin-leads.html"'
      ]
    };

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

      if (pageMarkers[page]) {
        pageMarkers[page].forEach((marker) => {
          assertIncludes(pageResponse.text, marker, `Page ${page} missing marker: ${marker}`);
        });
      }
    }
    console.log("OK: static pages + layout markers");

    const styleText = await fs.readFile(path.join(ROOT_DIR, "style.css"), "utf8");
    verifyThemeCoverage(styleText);
    assertIncludes(styleText, ".training-layout", "Missing training layout styles");
    assertIncludes(styleText, ".training-summary", "Missing training summary styles");
    console.log("OK: theme mode coverage");

    const adminUiText = await fs.readFile(path.join(ROOT_DIR, "admin-ui.css"), "utf8");
    verifyAdminUiCoverage(adminUiText);
    console.log("OK: admin-ui coverage");

    const coreScript = await fs.readFile(path.join(ROOT_DIR, "script.js"), "utf8");
    assertIncludes(coreScript, 'href="admin-events.html"', "Workspace shell missing events link");
    assertIncludes(coreScript, 'href="admin-training.html"', "Workspace shell missing training link");
    console.log("OK: workspace navigation");

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
    const allowedRoles = new Set(["owner", "product", "manager"]);
    const hasOnlySupportedRoles = team.json.users.every((user) =>
      allowedRoles.has(String(user?.role || ""))
    );
    assert(hasOnlySupportedRoles, "Failed: /api/admin/team contains deprecated roles.");
    console.log("OK: /api/admin/team (public workspace)");

    const legacyHelpLogin = await request({
      method: "POST",
      pathname: "/api/admin/login",
      body: {
        username: "sales_help",
        password: "change-sales-help"
      },
      expectedStatus: 401
    });
    assert(
      legacyHelpLogin.json && legacyHelpLogin.json.error === "INVALID_CREDENTIALS",
      "Failed: legacy sales_help account should not be available."
    );
    console.log("OK: legacy system help account is disabled");

    const ownerLogin = await request({
      method: "POST",
      pathname: "/api/admin/login",
      body: {
        username: QA_ADMIN_USERNAME,
        password: QA_ADMIN_PASSWORD
      },
      expectedStatus: 200
    });
    const ownerToken = String(ownerLogin.json?.token || "");
    assert(ownerToken.length > 20, "Failed: owner token not received.");
    console.log("OK: /api/admin/login");

    const legacyRoleUsername = `qa_role_${Date.now()}`;
    const createdLegacyRoleUser = await request({
      method: "POST",
      pathname: "/api/admin/users",
      token: ownerToken,
      body: {
        username: legacyRoleUsername,
        password: "qa_role_password",
        name: "QA Legacy Role",
        role: "help",
        department: "sales"
      },
      expectedStatus: 201
    });
    const createdLegacyRole = String(createdLegacyRoleUser.json?.user?.role || "");
    const createdLegacyUserId = String(createdLegacyRoleUser.json?.user?.id || "");
    assert(createdLegacyRole === "manager", "Failed: POST /api/admin/users role help should map to manager.");
    assert(createdLegacyUserId.length > 0, "Failed: created user id is empty.");

    const patchedLegacyRoleUser = await request({
      method: "PATCH",
      pathname: `/api/admin/users/${encodeURIComponent(createdLegacyUserId)}`,
      token: ownerToken,
      body: {
        role: "worker"
      },
      expectedStatus: 200
    });
    assert(
      String(patchedLegacyRoleUser.json?.user?.role || "") === "manager",
      "Failed: PATCH /api/admin/users role worker should map to manager."
    );

    const adminUsers = await request({
      method: "GET",
      pathname: "/api/admin/users",
      token: ownerToken,
      expectedStatus: 200
    });
    assert(
      Array.isArray(adminUsers.json?.users) &&
        adminUsers.json.users.every((user) => allowedRoles.has(String(user?.role || ""))),
      "Failed: /api/admin/users contains deprecated roles."
    );

    const removedLegacyRoleUser = await request({
      method: "DELETE",
      pathname: `/api/admin/users/${encodeURIComponent(createdLegacyUserId)}`,
      token: ownerToken,
      expectedStatus: 200
    });
    assert(
      removedLegacyRoleUser.json &&
        removedLegacyRoleUser.json.ok === true &&
        removedLegacyRoleUser.json.removedUserId === createdLegacyUserId,
      "Failed: DELETE /api/admin/users/:id for qa legacy role user."
    );
    console.log("OK: user role migration compatibility");

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

    const deleteDoneLead = await request({
      method: "DELETE",
      pathname: `/api/admin/leads/${encodeURIComponent(leadId)}`,
      expectedStatus: 403
    });
    assert(
      deleteDoneLead.json && deleteDoneLead.json.error === "FORBIDDEN_DELETE_STATUS",
      "Failed: DELETE /api/admin/leads/:id should reject done leads."
    );

    const deletableLead = await request({
      method: "POST",
      pathname: "/api/leads",
      body: {
        name: "QA Delete Candidate",
        contact: "qa-delete@example.com",
        type: "Landing",
        message: "Lead for deletion test",
        sourcePage: "/contact.html"
      },
      expectedStatus: 201
    });
    const deletableLeadId = String(deletableLead.json?.leadId || "");
    assert(deletableLeadId.length > 0, "Failed: second lead creation for delete test.");

    const moveDeletableToWork = await request({
      method: "PATCH",
      pathname: `/api/admin/leads/${encodeURIComponent(deletableLeadId)}`,
      body: { status: "in_progress" },
      expectedStatus: 200
    });
    assert(
      moveDeletableToWork.json &&
        moveDeletableToWork.json.ok === true &&
        moveDeletableToWork.json.lead &&
        moveDeletableToWork.json.lead.status === "in_progress",
      "Failed: prepare in_progress lead for delete."
    );

    const deleteInProgressLead = await request({
      method: "DELETE",
      pathname: `/api/admin/leads/${encodeURIComponent(deletableLeadId)}`,
      expectedStatus: 200
    });
    assert(
      deleteInProgressLead.json &&
        deleteInProgressLead.json.ok === true &&
        deleteInProgressLead.json.deletedLeadId === deletableLeadId,
      "Failed: DELETE /api/admin/leads/:id in_progress lead."
    );

    const leadsAfterDelete = await request({
      method: "GET",
      pathname: "/api/admin/leads?limit=5000",
      expectedStatus: 200
    });
    const deletedStillExists = Array.isArray(leadsAfterDelete.json?.leads)
      ? leadsAfterDelete.json.leads.some((item) => item.id === deletableLeadId)
      : true;
    assert(!deletedStillExists, "Failed: deleted lead still exists in /api/admin/leads.");
    console.log("OK: DELETE /api/admin/leads/:id");

    const commentText = `QA comment ${Date.now()}`;
    const comment = await request({
      method: "POST",
      pathname: `/api/admin/leads/${encodeURIComponent(leadId)}/comments`,
      body: { text: commentText },
      expectedStatus: 201
    });
    assert(
      comment.json &&
        comment.json.ok === true &&
        comment.json.comment &&
        comment.json.comment.text === commentText &&
        typeof comment.json.comment.authorUsername === "string" &&
        comment.json.comment.authorUsername.length > 0 &&
        /\d{4}-\d{2}-\d{2}T/.test(String(comment.json.comment.createdAt || "")),
      "Failed: POST /api/admin/leads/:id/comments metadata"
    );

    const leadsAfterComment = await request({
      method: "GET",
      pathname: "/api/admin/leads?limit=5000",
      expectedStatus: 200
    });
    const foundLeadAfterComment = Array.isArray(leadsAfterComment.json?.leads)
      ? leadsAfterComment.json.leads.find((item) => item.id === leadId)
      : null;
    const persistedComment = Array.isArray(foundLeadAfterComment?.comments)
      ? foundLeadAfterComment.comments.find((item) => item.text === commentText)
      : null;
    assert(
      Boolean(
        persistedComment &&
          typeof persistedComment.authorUsername === "string" &&
          persistedComment.authorUsername.length > 0 &&
          /\d{4}-\d{2}-\d{2}T/.test(String(persistedComment.createdAt || ""))
      ),
      "Failed: comment persistence in /api/admin/leads"
    );
    console.log("OK: POST /api/admin/leads/:id/comments");

    const events = await request({
      method: "GET",
      pathname: "/api/admin/events?limit=50&scope=all",
      expectedStatus: 200
    });
    assert(
      events.json &&
        events.json.ok === true &&
        Array.isArray(events.json.events) &&
        events.json.stats &&
        Number.isFinite(Number(events.json.total)),
      "Failed: /api/admin/events payload"
    );
    console.log("OK: /api/admin/events");

    const training = await request({
      method: "GET",
      pathname: "/api/admin/training?limit=120",
      expectedStatus: 200
    });
    assert(
      training.json &&
        training.json.ok === true &&
        Array.isArray(training.json.users) &&
        Array.isArray(training.json.profiles) &&
        Array.isArray(training.json.reviews) &&
        training.json.stats,
      "Failed: /api/admin/training payload"
    );

    const trainingUser = training.json.users.find((item) => item.role !== "owner") || null;
    assert(Boolean(trainingUser && trainingUser.id), "No training user available for QA checks.");
    console.log("OK: /api/admin/training");

    const trainingAssign = await request({
      method: "PATCH",
      pathname: `/api/admin/training/assignments/${encodeURIComponent(trainingUser.id)}`,
      body: {
        assigned: true,
        note: "QA assignment"
      },
      expectedStatus: 200
    });
    assert(
      trainingAssign.json &&
        trainingAssign.json.ok === true &&
        trainingAssign.json.assignment &&
        trainingAssign.json.assignment.user &&
        trainingAssign.json.assignment.user.id === trainingUser.id &&
        trainingAssign.json.assignment.assignment &&
        trainingAssign.json.assignment.assignment.assigned === true,
      "Failed: PATCH /api/admin/training/assignments/:id"
    );
    console.log("OK: PATCH /api/admin/training/assignments/:id");

    const trainingProfilePatch = await request({
      method: "PATCH",
      pathname: `/api/admin/training/profiles/${encodeURIComponent(trainingUser.id)}`,
      body: {
        currentDay: 9,
        stage: "diagnostics",
        status: "active",
        confidence: 4,
        energy: 4,
        control: 4,
        notes: "QA training update"
      },
      expectedStatus: 200
    });
    assert(
      trainingProfilePatch.json &&
        trainingProfilePatch.json.ok === true &&
        trainingProfilePatch.json.profile &&
        trainingProfilePatch.json.profile.userId === trainingUser.id,
      "Failed: PATCH /api/admin/training/profiles/:id"
    );
    console.log("OK: PATCH /api/admin/training/profiles/:id");

    const trainingReview = await request({
      method: "POST",
      pathname: "/api/admin/training/reviews",
      body: {
        userId: trainingUser.id,
        channel: "call",
        start: 13,
        diagnostics: 21,
        presentation: 16,
        objections: 12,
        closing: 12,
        crm: 8,
        redFlags: ["talked_too_much"],
        confidence: 4,
        energy: 4,
        control: 4,
        comment: "QA review"
      },
      expectedStatus: 201
    });
    assert(
      trainingReview.json &&
        trainingReview.json.ok === true &&
        trainingReview.json.review &&
        Number(trainingReview.json.review.totalScore) === 82 &&
        trainingReview.json.profile &&
        trainingReview.json.profile.userId === trainingUser.id,
      "Failed: POST /api/admin/training/reviews"
    );
    console.log("OK: POST /api/admin/training/reviews");

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
