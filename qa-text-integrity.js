"use strict";

const fs = require("fs/promises");
const path = require("path");

// Mojibake indicators when UTF-8 text is decoded with CP1251/CP1252.
// Built with explicit Unicode escapes so the checker itself is encoding-safe.
const RARE_MOJIBAKE_CHARS =
  /[\u0403\u0453\u0409\u0459\u040A\u045A\u040C\u045C\u040B\u045B\u040F\u045F\u040E\u045E\u0402\u0452\u0404\u0454\u0407\u0457\u0406\u0456\u0491\u2116\u00A4\u00A5\u00A6\u00A7]/g;

const BROKEN_UTF8_CP1251_PAIRS =
  /(?:\u0420[\u00A0-\u00BF\u0402\u0403\u0409\u040A\u040B\u040C\u040E\u040F\u0451\u0452\u0453\u0454\u0457\u0459\u045A\u045B\u045C\u045E\u045F\u0491\u2116]|\u0421[\u0402\u0403\u0409\u040A\u040B\u040C\u040E\u040F\u0452\u0453\u0459\u045A\u045B\u045C\u045E\u045F])/g;

const BROKEN_UTF8_CP1252_TOKENS =
  /(?:\u0432\u0402|\u0432\u201E|\u0432\u20AC|\u0432\u2020|\u0412\u00A9|\u0412\u00AE)/g;

// "����" cases: Unicode replacement char and its double-decoded form ("ï¿½").
const UTF8_REPLACEMENT_CHAR = /\uFFFD/g;
const DOUBLE_ENCODED_REPLACEMENT = /\u00EF\u00BF\u00BD/g;
const EXPLICIT_MOJIBAKE_TOKENS = [
  "\u0420\u045f\u0420\u0455\u0421\u20ac\u0420\u00b0\u0420\u0456\u0420\u0455\u0420\u0406\u0420\u0455\u0420\u00b5 \u0420\u0457\u0421\u0402\u0420\u0455\u0421\u2026\u0420\u0455\u0420\u00b6\u0420\u0491\u0420\u00b5\u0420\u0405\u0420\u0451\u0420\u00b5 \u0420\u0455\u0420\u00b1\u0421\u0453\u0421\u2021\u0420\u00b5\u0420\u0405\u0420\u0451\u0421\u040f"
];

function countMatches(text, regex) {
  const matches = String(text || "").match(regex);
  return matches ? matches.length : 0;
}

function lineLooksMojibake(line) {
  const text = String(line || "");
  const rareCount = countMatches(text, RARE_MOJIBAKE_CHARS);
  const pairCount = countMatches(text, BROKEN_UTF8_CP1251_PAIRS);
  const cp1252Count = countMatches(text, BROKEN_UTF8_CP1252_TOKENS);
  const replacementCount = countMatches(text, UTF8_REPLACEMENT_CHAR);
  const doubleReplacementCount = countMatches(text, DOUBLE_ENCODED_REPLACEMENT);
  const score =
    rareCount +
    pairCount * 2 +
    cp1252Count * 2 +
    replacementCount * 4 +
    doubleReplacementCount * 4;

  return {
    score,
    rareCount,
    pairCount,
    cp1252Count,
    replacementCount,
    doubleReplacementCount
  };
}

async function findMojibakeIssues(rootDir, filePaths) {
  const issues = [];
  const files = Array.isArray(filePaths) ? filePaths : [];

  for (const relPath of files) {
    const fullPath = path.join(rootDir, relPath);
    const text = await fs.readFile(fullPath, "utf8");
    const lines = text.split(/\r?\n/);

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const check = lineLooksMojibake(line);
      if (check.score < 3) {
        continue;
      }

      issues.push({
        file: relPath.replace(/\\/g, "/"),
        line: idx + 1,
        score: check.score,
        sample: line.trim().slice(0, 180)
      });
    }
  }

  return issues;
}

async function findExplicitMojibakeTokenIssues(rootDir, filePaths) {
  const issues = [];
  const files = Array.isArray(filePaths) ? filePaths : [];
  if (!EXPLICIT_MOJIBAKE_TOKENS.length) {
    return issues;
  }

  for (const relPath of files) {
    const fullPath = path.join(rootDir, relPath);
    const text = await fs.readFile(fullPath, "utf8");
    const lines = text.split(/\r?\n/);

    for (let idx = 0; idx < lines.length; idx += 1) {
      const line = lines[idx];
      const token = EXPLICIT_MOJIBAKE_TOKENS.find((item) => line.includes(item));
      if (!token) {
        continue;
      }

      issues.push({
        file: relPath.replace(/\\/g, "/"),
        line: idx + 1,
        score: 999,
        sample: `forbidden mojibake token: ${token}`
      });
    }
  }

  return issues;
}

function formatIssues(issues, limit = 20) {
  return issues
    .slice(0, limit)
    .map((item) => `${item.file}:${item.line} [score:${item.score}] ${item.sample}`)
    .join("\n");
}

async function assertNoMojibakeInFiles(rootDir, filePaths) {
  const [heuristicIssues, explicitIssues] = await Promise.all([
    findMojibakeIssues(rootDir, filePaths),
    findExplicitMojibakeTokenIssues(rootDir, filePaths)
  ]);
  const issues = [...explicitIssues, ...heuristicIssues];
  if (!issues.length) {
    return;
  }

  const details = formatIssues(issues);
  const total = issues.length;
  throw new Error(
    `Detected possible mojibake (${total} line${total === 1 ? "" : "s"}).\n${details}`
  );
}

module.exports = {
  assertNoMojibakeInFiles,
  findMojibakeIssues,
  findExplicitMojibakeTokenIssues
};
