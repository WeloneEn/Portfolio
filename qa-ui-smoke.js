"use strict";

const fs = require("fs/promises");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT_DIR = __dirname;

const HTML_FILES = [
  "index.html",
  "about.html",
  "projects.html",
  "contact.html",
  "admin.html",
  "admin-leads.html",
  "admin-events.html",
  "admin-training.html"
];

const JS_FILES = [
  "config.js",
  "script.js",
  "admin.js",
  "admin-leads.js",
  "admin-events.js",
  "admin-training.js"
];

const DYNAMIC_ID_ALLOWLIST = new Set([
  "futureCinematic",
  "futureSecretClose",
  "futureSecretForm",
  "futureSecretInput",
  "futureSecretStatus",
  "marioCameo",
  "secretToast",
  "workspaceShell",
  "workspaceStatus"
]);

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

function extractAttrValues(text, attrName) {
  const regex = new RegExp(`${attrName}="([^"]+)"`, "g");
  const values = [];
  let match;
  while ((match = regex.exec(text))) {
    values.push(String(match[1] || "").trim());
  }
  return values.filter(Boolean);
}

function extractControlIds(htmlText) {
  const regex = /<(button|input|select|textarea|form|dialog)\b[^>]*\bid="([^"]+)"/g;
  const out = [];
  let match;
  while ((match = regex.exec(htmlText))) {
    out.push({
      tag: String(match[1] || "").toLowerCase(),
      id: String(match[2] || "").trim()
    });
  }
  return out.filter((entry) => entry.id);
}

function extractGetElementByIdRefs(jsText) {
  const regex = /getElementById\("([^"]+)"\)/g;
  const out = new Set();
  let match;
  while ((match = regex.exec(jsText))) {
    out.add(String(match[1] || "").trim());
  }
  return out;
}

function isLocalHref(hrefValue) {
  return !/^(https?:|mailto:|tel:|#)/i.test(hrefValue);
}

async function run() {
  JS_FILES.forEach((filePath) => runNodeCheck(filePath));
  console.log("+: syntax checks");

  const htmlByFile = new Map();
  for (const fileName of HTML_FILES) {
    const text = await fs.readFile(path.join(ROOT_DIR, fileName), "utf8");
    htmlByFile.set(fileName, text);
  }

  const jsByFile = new Map();
  for (const fileName of JS_FILES) {
    const text = await fs.readFile(path.join(ROOT_DIR, fileName), "utf8");
    jsByFile.set(fileName, text);
  }

  const styleText = await fs.readFile(path.join(ROOT_DIR, "style.css"), "utf8");
  const adminUiText = await fs.readFile(path.join(ROOT_DIR, "admin-ui.css"), "utf8");

  for (const [fileName, html] of htmlByFile.entries()) {
    assertIncludes(html, 'id="themeToggle"', `Missing theme toggle in ${fileName}`);
    assertIncludes(html, 'id="menuToggle"', `Missing menu toggle in ${fileName}`);
    assertIncludes(html, 'src="config.js', `Missing config.js include in ${fileName}`);
    assertIncludes(html, 'src="script.js', `Missing script.js include in ${fileName}`);
  }
  console.log("+: page shell controls");

  const adminPageChecks = [
    { file: "admin.html", marker: 'src="admin.js' },
    { file: "admin-leads.html", marker: 'src="admin-leads.js' },
    { file: "admin-events.html", marker: 'src="admin-events.js' },
    { file: "admin-training.html", marker: 'src="admin-training.js' }
  ];

  adminPageChecks.forEach(({ file, marker }) => {
    const html = htmlByFile.get(file) || "";
    assertIncludes(html, "admin-ui.css", `Missing admin-ui.css include in ${file}`);
    assertIncludes(html, marker, `Missing admin page script in ${file}`);
  });
  console.log("+: admin pages includes");

  for (const [fileName, html] of htmlByFile.entries()) {
    const hrefs = extractAttrValues(html, "href");
    for (const href of hrefs) {
      if (!isLocalHref(href)) {
        continue;
      }
      const cleanPath = href.split("#")[0].split("?")[0].trim();
      if (!cleanPath) {
        continue;
      }
      const targetPath = path.join(ROOT_DIR, cleanPath.replace(/\//g, path.sep));
      try {
        await fs.access(targetPath);
      } catch {
        throw new Error(`Broken local href in ${fileName}: ${href}`);
      }
    }
  }
  console.log("+: local links");

  [
    "body.light-mode .event-card",
    "body.future-mode .event-card",
    "body.light-mode .training-summary__item",
    "body.future-mode .training-summary__item",
    "@media (max-width: 760px)",
    ".site-nav a",
    ".btn,"
  ].forEach((selector) => {
    assertIncludes(styleText, selector, `Missing style marker: ${selector}`);
  });

  [
    'body.light-mode[data-page="admin"]',
    'body.future-mode[data-page="admin"]',
    "@media (max-width: 760px)"
  ].forEach((selector) => {
    assertIncludes(adminUiText, selector, `Missing admin-ui marker: ${selector}`);
  });
  console.log("+: theme and mobile CSS");

  const allHtmlIds = new Set();
  const buttonIds = [];
  for (const html of htmlByFile.values()) {
    const ids = extractAttrValues(html, "id");
    ids.forEach((id) => allHtmlIds.add(id));
    const controls = extractControlIds(html);
    controls.forEach((control) => {
      if (control.tag === "button") {
        buttonIds.push(control.id);
      }
    });
  }

  const allJsText = Array.from(jsByFile.values()).join("\n");
  const getElementIds = new Set();
  for (const jsText of jsByFile.values()) {
    const refs = extractGetElementByIdRefs(jsText);
    refs.forEach((id) => getElementIds.add(id));
  }

  const missingIdRefs = Array.from(getElementIds).filter(
    (id) => !allHtmlIds.has(id) && !DYNAMIC_ID_ALLOWLIST.has(id)
  );
  assert(missingIdRefs.length === 0, `JS references missing HTML ids: ${missingIdRefs.join(", ")}`);

  const unboundButtons = buttonIds.filter((id) => !allJsText.includes(id));
  assert(unboundButtons.length === 0, `Buttons without JS references: ${unboundButtons.join(", ")}`);
  console.log("+: html/js bindings");

  const coreScript = jsByFile.get("script.js") || "";
  assertIncludes(coreScript, 'getElementById("easterEgg")', "Missing easterEgg binding in script.js");
  assertIncludes(coreScript, 'getElementById("closeEgg")', "Missing closeEgg binding in script.js");
  assertIncludes(coreScript, "showEasterEggDialog", "Missing easterEgg dialog handlers in script.js");
  assert(!allJsText.includes("ownerAdminLink"), "Legacy ownerAdminLink token still exists");
  assert(!allJsText.includes("leadsAdminNavLink"), "Legacy leadsAdminNavLink token still exists");
  console.log("+: legacy cleanup checks");

  assertIncludes(coreScript, "assets/models/command-jet.svg", "Missing command-jet model reference");
  assertIncludes(coreScript, "assets/models/mario.svg", "Missing mario model reference");
  assert(!coreScript.includes("assets/models/rocket.svg"), "Legacy rocket model reference still exists");
  console.log("+: models usage");

  console.log("\nUI SMOKE PASSED");
}

run().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
