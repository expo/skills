// Shared helpers for Expo skills PostHog telemetry.
//
// Zero npm dependencies — Node.js built-ins only (crypto, fs, https, os, path).
// Node is a hard requirement for Expo development, so it is available wherever
// these skills are used. If `node` is ever missing, the calling hook simply
// fails non-blocking and no telemetry is sent.

const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const os = require("os");
const path = require("path");

const POSTHOG_HOST = "https://us.i.posthog.com";

// PostHog project API key. This is a *write-only, public* ingestion key — the
// same kind embedded in browser snippets — so it is safe to commit. Override
// per environment with EXPO_SKILLS_POSTHOG_KEY (e.g. a staging project).
// NOTE: never put a PostHog *personal* API key (phx_...) here — those are secret.
const POSTHOG_PROJECT_API_KEY =
  process.env.EXPO_SKILLS_POSTHOG_KEY || "phc_w8xRytdAAwkV3oExnuUozqH64PMzCmDLnyoChpPBcNXs";

const SOURCE = "expo-skills";
const SCHEMA_VERSION = 1;
const INSTALLATION_ID_PATH = path.join(
  os.homedir(),
  ".expo-skills",
  "installation-id"
);

// Persistent opt-out marker. Checked before anything is sent, so it works
// regardless of how the agent was launched (env vars don't always reach hook
// subprocesses). Toggle it with scripts/telemetry.js --off / --on.
const OPT_OUT_PATH = path.join(os.homedir(), ".expo-skills", "opt-out");

// Marker so the one-time "we collect anonymous telemetry" notice prints once.
const NOTICE_PATH = path.join(os.homedir(), ".expo-skills", "notice-shown");

// CI detection — skip telemetry in automated environments so usage data reflects
// real humans. Honors the common CI=true convention plus major providers' signals.
function isCI() {
  const ci = String(process.env.CI || "").trim().toLowerCase();
  if (ci && ci !== "0" && ci !== "false") return true;
  return Boolean(
    process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.BUILDKITE ||
      process.env.JENKINS_URL ||
      process.env.TEAMCITY_VERSION ||
      process.env.TF_BUILD
  );
}

// Opt-out switch. Disabled when EXPO_SKILLS_TELEMETRY is 0/false/off/no, or
// when the cross-tool DO_NOT_TRACK convention (https://consoledonottrack.com)
// is set to anything other than 0/false.
function telemetryDisabled() {
  // 1) Persistent opt-out file — the reliable, launch-independent switch.
  try { if (fs.existsSync(OPT_OUT_PATH)) return true; } catch {}
  // 2) Skip automated / CI environments.
  if (isCI()) return true;
  // 3) Env vars — for global opt-out.
  const flag = String(process.env.EXPO_SKILLS_TELEMETRY || "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(flag)) return true;
  const dnt = String(process.env.DO_NOT_TRACK || "").trim().toLowerCase();
  if (dnt && dnt !== "0" && dnt !== "false") return true;
  return false;
}

// Whether a usable PostHog project key is present. A real key ships in this
// file by default, so telemetry is ON by default (anonymous; opt out via
// telemetryDisabled()). This guard only makes the scripts inert if someone
// strips the key to empty / "phc_REPLACE_ME" (e.g. a fork or a private build).
function telemetryConfigured() {
  const key = String(POSTHOG_PROJECT_API_KEY || "").trim();
  return key.length > 0 && key !== "phc_REPLACE_ME";
}

// Best-effort agent-harness detection from environment signals — used as the
// default when --agent-harness isn't passed. Claude Code sets CLAUDECODE; Codex
// sets CODEX_SANDBOX (in sandboxed mode) and is moving toward AGENT=codex.
function detectHarness() {
  if (process.env.CLAUDECODE) return "claude-code";
  if (
    process.env.CODEX_SANDBOX ||
    process.env.CODEX_SANDBOX_NETWORK_DISABLED ||
    String(process.env.AGENT || "").toLowerCase() === "codex"
  ) {
    return "codex";
  }
  return "unknown";
}

// Friendly OS + CPU arch for event properties (non-PII).
function platformProps() {
  const osName = { darwin: "macos", win32: "windows" }[process.platform] || process.platform;
  return { os: osName, arch: process.arch };
}

// Print a one-time transparency notice the first time real telemetry is sent.
// Best-effort and gated by an atomic marker, so it appears at most once per machine.
function maybeShowFirstRunNotice() {
  try {
    fs.mkdirSync(path.dirname(NOTICE_PATH), { recursive: true, mode: 0o700 });
    const fd = fs.openSync(NOTICE_PATH, "wx", 0o600); // succeeds only the first time
    fs.closeSync(fd);
    process.stderr.write(
      "expo-skills: sending anonymous usage analytics (skill name only — no code, prompts, " +
        "or personal data). Turn off with `telemetry.js --off` or EXPO_SKILLS_TELEMETRY=0.\n"
    );
  } catch {
    // Already shown, or filesystem unavailable — stay silent.
  }
}

function shortHash(value, length = 16) {
  if (!value) return null;
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

// Deterministic JSON with sorted keys for a consistent $insert_id hash. (Events are
// still unique per invocation — callers include `timestamp` in the hashed input.)
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

function readInstallationId(create = true) {
  try {
    if (fs.existsSync(INSTALLATION_ID_PATH)) {
      const existing = fs.readFileSync(INSTALLATION_ID_PATH, "utf8").trim();
      if (existing) return existing;
    }
    if (!create) return null;

    fs.mkdirSync(path.dirname(INSTALLATION_ID_PATH), { recursive: true, mode: 0o700 });
    try { fs.chmodSync(path.dirname(INSTALLATION_ID_PATH), 0o700); } catch {}

    const installationId = crypto.randomUUID().replace(/-/g, "");
    try {
      // 'wx' = O_CREAT | O_EXCL | O_WRONLY — atomic create, fails if it exists.
      const fd = fs.openSync(INSTALLATION_ID_PATH, "wx", 0o600);
      try { fs.writeFileSync(fd, installationId + "\n"); } finally { fs.closeSync(fd); }
      return installationId;
    } catch (err) {
      if (err && err.code === "EEXIST") {
        const existing = fs.readFileSync(INSTALLATION_ID_PATH, "utf8").trim();
        return existing || null;
      }
      throw err;
    }
  } catch {
    return null;
  }
}

function installationIdHash(create = true) {
  return shortHash(readInstallationId(create), 32);
}

function telemetryIdentity(agentHarness, { createInstallation = true } = {}) {
  const installHash = installationIdHash(createInstallation);
  if (installHash) {
    return [`expo-skills-installation:${installHash}`, { installation_id_hash: installHash }];
  }
  return [`expo-skills-events:${agentHarness}`, {}];
}

function sendToPosthog(payload, { userAgent, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const url = new URL("/i/v0/e/", POSTHOG_HOST);
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body.length,
          "User-Agent": userAgent,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const status = res.statusCode || 0;
          if (status >= 200 && status < 300) return resolve();
          reject(new Error(`HTTP ${status} ${Buffer.concat(chunks).toString("utf8")}`));
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  POSTHOG_HOST,
  POSTHOG_PROJECT_API_KEY,
  SOURCE,
  SCHEMA_VERSION,
  INSTALLATION_ID_PATH,
  OPT_OUT_PATH,
  telemetryDisabled,
  telemetryConfigured,
  detectHarness,
  isCI,
  platformProps,
  maybeShowFirstRunNotice,
  shortHash,
  stableStringify,
  readInstallationId,
  installationIdHash,
  telemetryIdentity,
  sendToPosthog,
};
