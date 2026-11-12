const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { summarize } = require("./session-status.cjs");

const runtimeKeys = [
  "PATH", "HOME", "USER", "LOGNAME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE",
  "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
  "http_proxy", "https_proxy", "all_proxy", "no_proxy",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "NODE_EXTRA_CA_CERTS",
];

try {
  const [expectedId, controller, ...args] = process.argv.slice(2);
  const session = JSON.parse(fs.readFileSync(0, "utf8"));
  if (!summarize(session, expectedId, controller).ready || args.length === 0) throw new Error();
  const config = session.remoteConfig;
  const env = Object.fromEntries(runtimeKeys.filter(key => process.env[key] !== undefined)
    .map(key => [key, process.env[key]]));
  let command;
  let commandArgs;
  switch (controller) {
    case "agent-device":
      command = process.env.AGENT_DEVICE_BIN;
      if (typeof command !== "string" || !path.isAbsolute(command) || !fs.statSync(command).isFile()) throw new Error();
      commandArgs = args;
      env.AGENT_DEVICE_DAEMON_BASE_URL = config.agentDeviceRemoteSessionUrl;
      env.AGENT_DEVICE_DAEMON_AUTH_TOKEN = config.agentDeviceRemoteSessionToken;
      break;
    case "argent":
    case "appium":
      [command, ...commandArgs] = args;
      // The caller reviews this local client; no command is read from remote session data.
      if (!path.isAbsolute(command) || !fs.statSync(command).isFile()) throw new Error();
      if (controller === "argent") {
        env.ARGENT_TOOLS_URL = config.toolsUrl;
        if (config.toolsAuthToken != null) {
          if (typeof config.toolsAuthToken !== "string") throw new Error();
          env.ARGENT_AUTH_TOKEN = config.toolsAuthToken;
        }
      } else {
        env.APPIUM_URL = config.appiumUrl;
        env.APPIUM_CAPS = JSON.stringify(config.capabilities);
      }
      break;
    default:
      throw new Error();
  }
  const result = spawnSync(command, commandArgs, { env, stdio: "inherit", shell: false });
  if (result.error || result.signal || result.status === null) {
    console.error("Simulator controller did not complete; inspect private diagnostics before retrying.");
    process.exitCode = 1;
  } else {
    process.exitCode = result.status;
  }
} catch {
  console.error("Simulator controller input is unverified; stop before driving.");
  process.exitCode = 1;
}
