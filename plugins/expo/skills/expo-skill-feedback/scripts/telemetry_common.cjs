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
const INSTALLATION_ID_PATH = path.join(os.homedir(), ".expo-skills", "installation-id");

// Opt-in is the model: telemetry is OFF by default and only sends once the user
// explicitly enables it. This is the one product knob — flip to true for an opt-out
// (on-by-default) model instead.
const DEFAULT_ON = false;

// Persistent opt-in marker. Its presence turns telemetry on across sessions, regardless
// of how the agent was launched (env vars don't always reach hook subprocesses).
// Written / removed by scripts/telemetry.cjs --on / --off.
const OPT_IN_PATH = path.join(os.homedir(), ".expo-skills", "opt-in");

// CI detection — never emit from automated environments so usage data reflects real
// humans. Honors the common CI=true convention plus major providers' signals.
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

// Explicit on/off intent from env vars: returns "on" | "off" | null.
//   DO_NOT_TRACK=1                        -> off (https://consoledonottrack.com)
//   EXPO_SKILLS_TELEMETRY=0/off/false/no  -> off
//   EXPO_SKILLS_TELEMETRY=1/on/true/yes   -> on
function telemetryEnvSignal() {
  const dnt = String(process.env.DO_NOT_TRACK || "").trim().toLowerCase();
  if (dnt && dnt !== "0" && dnt !== "false") return "off";
  const flag = String(process.env.EXPO_SKILLS_TELEMETRY || "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(flag)) return "off";
  if (["1", "true", "on", "yes"].includes(flag)) return "on";
  return null;
}

// Master gate. Nothing is sent unless this returns true. Precedence (highest first):
//   1. explicit env off (DO_NOT_TRACK / EXPO_SKILLS_TELEMETRY=0) -> off
//   2. CI                                                        -> off (never emit from bots)
//   3. explicit env on  (EXPO_SKILLS_TELEMETRY=1)                -> on
//   4. persistent opt-in marker (telemetry.cjs --on)            -> on
//   5. default                                                   -> DEFAULT_ON (off = opt-in)
// So explicit-off and CI always win; otherwise it's on only when explicitly enabled.
function telemetryActive() {
  const env = telemetryEnvSignal();
  if (env === "off") return false;
  if (isCI()) return false;
  if (env === "on") return true;
  try { if (fs.existsSync(OPT_IN_PATH)) return true; } catch {}
  return DEFAULT_ON;
}

// A real key ships in this file, so this check passes by default. This guard only
// makes the scripts inert if someone strips the key (e.g. a fork or private build).
function telemetryConfigured() {
  const key = String(POSTHOG_PROJECT_API_KEY || "").trim();
  return key.length > 0 && key !== "phc_REPLACE_ME";
}

// Best-effort agent-harness label for the event (default when --agent-harness isn't passed).
function detectHarness() {
  if (process.env.CLAUDECODE) return "claude-code";
  if (process.env.CODEX_SANDBOX || process.env.CODEX_SANDBOX_NETWORK_DISABLED ||
      String(process.env.AGENT || "").toLowerCase() === "codex") return "codex";
  return "unknown";
}

// Friendly OS + CPU arch for event properties (non-PII).
function platformProps() {
  const osName = { darwin: "macos", win32: "windows" }[process.platform] || process.platform;
  return { os: osName, arch: process.arch };
}

// Random, anonymous, per-install id — created once at 0600, only its hash is ever sent.
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
      if (err && err.code === "EEXIST") return fs.readFileSync(INSTALLATION_ID_PATH, "utf8").trim() || null;
      throw err;
    }
  } catch {
    return null;
  }
}

function telemetryIdentity(agentHarness, { createInstallation = true } = {}) {
  const id = readInstallationId(createInstallation);
  const installHash = id ? crypto.createHash("sha256").update(id).digest("hex").slice(0, 32) : null;
  if (installHash) return [`expo-skills-installation:${installHash}`, { installation_id_hash: installHash }];
  return [`expo-skills-events:${agentHarness}`, {}];
}

function sendToPosthog(payload, { userAgent, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const url = new URL("/i/v0/e/", POSTHOG_HOST);
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    const req = https.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": body.length, "User-Agent": userAgent },
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const status = res.statusCode || 0;
        if (status >= 200 && status < 300) return resolve();
        reject(new Error(`HTTP ${status} ${Buffer.concat(chunks).toString("utf8")}`));
      });
    });
    req.on("timeout", () => req.destroy(new Error("request timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  POSTHOG_PROJECT_API_KEY,
  SOURCE,
  OPT_IN_PATH,
  telemetryActive,
  telemetryEnvSignal,
  telemetryConfigured,
  detectHarness,
  isCI,
  platformProps,
  telemetryIdentity,
  sendToPosthog,
};
