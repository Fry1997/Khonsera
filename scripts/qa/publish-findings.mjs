import { readFile } from "node:fs/promises";
import path from "node:path";

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;
const runId = process.env.GITHUB_RUN_ID;
const runNumber = process.env.GITHUB_RUN_NUMBER ?? "unknown";

if (!token || !repository || !runId) {
  throw new Error("GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_RUN_ID are required.");
}

const [owner, repo] = repository.split("/");
const releaseUrl = `https://github.com/${repository}/releases/tag/qa-observer-${runId}`;
const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;

async function github(method, pathname, body) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `GitHub API ${method} ${pathname} failed ${response.status}: ${detail.slice(0, 1000)}`,
    );
  }

  return response.status === 204 ? null : response.json();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function issueTitle(finding) {
  return `[KQA-UX-001] ${clean(finding.title).slice(0, 180)}`;
}

function findingBody(finding, viewport) {
  const repro = Array.isArray(finding.repro_steps) && finding.repro_steps.length
    ? finding.repro_steps.map((step, index) => `${index + 1}. ${clean(step)}`).join("\n")
    : "See the linked adaptive replay and action log.";

  return `Adaptive production traveller QA found this while piloting Khonsera through the visible UI.

**Severity:** ${clean(finding.severity) || "unspecified"}
**Category:** ${clean(finding.category) || "ux"}
**Viewport:** ${viewport}
**Scenario:** KQA-UX-001
**Observer run:** [#${runNumber}](${runUrl})
**Evidence release:** ${releaseUrl}

### What happened

${clean(finding.evidence) || "See replay evidence."}

### Passenger impact

${clean(finding.passenger_impact) || "Passenger impact requires review."}

### Reproduction

${repro}

### QA context

This finding came from the adaptive computer-use pilot, not a fixed selector assertion. The pilot observes the rendered screen, chooses UI actions from the current state, and adapts when the interface differs from expectation.
`;
}

async function loadResult(viewport) {
  const resultPath = path.resolve(
    process.env.KQA_RESULTS_ROOT ?? "test-results/adaptive",
    viewport,
    "result.json",
  );

  try {
    return JSON.parse(await readFile(resultPath, "utf8"));
  } catch {
    return null;
  }
}

async function findOpenIssue(title) {
  const query = encodeURIComponent(
    `repo:${repository} is:issue is:open in:title "${title.replaceAll('"', "")}"`,
  );
  const result = await github("GET", `/search/issues?q=${query}&per_page=10`);
  return (result.items ?? []).find((item) => item.title === title) ?? null;
}

async function publishFinding(finding, viewport) {
  const title = issueTitle(finding);
  const body = findingBody(finding, viewport);
  const existing = await findOpenIssue(title);

  if (existing) {
    await github(
      "POST",
      `/repos/${owner}/${repo}/issues/${existing.number}/comments`,
      {
        body: `Observed again in adaptive QA run [#${runNumber}](${runUrl}) on **${viewport}**.\n\n${clean(finding.evidence)}\n\nEvidence: ${releaseUrl}`,
      },
    );
    console.log(`Updated existing issue #${existing.number}: ${title}`);
    return;
  }

  const issue = await github("POST", `/repos/${owner}/${repo}/issues`, {
    title,
    body,
  });
  console.log(`Created issue #${issue.number}: ${title}`);
}

const candidates = [];

for (const viewport of ["desktop-chromium", "mobile-390"]) {
  const result = await loadResult(viewport);
  if (!result) continue;

  for (const finding of result.pilot?.findings ?? []) {
    candidates.push({ finding, viewport });
  }

  for (const finding of result.technicalFindings ?? []) {
    candidates.push({ finding, viewport });
  }
}

const actionable = candidates.filter(({ finding }) =>
  ["high", "medium"].includes(String(finding.severity).toLowerCase()),
);

for (const { finding, viewport } of actionable) {
  await publishFinding(finding, viewport);
}

console.log(
  `Adaptive findings publisher considered ${candidates.length} findings and published/updated ${actionable.length} actionable items.`,
);
