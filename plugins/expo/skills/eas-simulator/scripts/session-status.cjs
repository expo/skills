const fs = require("node:fs");

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const statuses = new Set(["NEW", "QUEUED", "STARTING", "IN_PROGRESS", "STOPPED", "ERRORED"]);
const controllers = {
  "agent-device": ["AgentDeviceRunSessionRemoteConfig"],
  argent: ["ArgentRunSessionRemoteConfig"],
  appium: ["AppiumRunSessionRemoteConfig"],
  "web-preview-only": ["ServeSimRunSessionRemoteConfig", "WebPreviewOnlyRunSessionRemoteConfig"],
};
const text = (value) => typeof value === "string" && value.trim().length > 0;
const https = (value) => {
  if (!text(value) || /[\x00-\x20\x7f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
};

function hasController(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return false;
  switch (config.__typename) {
    case "AgentDeviceRunSessionRemoteConfig":
      return https(config.agentDeviceRemoteSessionUrl) && text(config.agentDeviceRemoteSessionToken);
    case "ArgentRunSessionRemoteConfig":
      return https(config.toolsUrl);
    case "AppiumRunSessionRemoteConfig":
      return https(config.appiumUrl) && config.capabilities !== null &&
        typeof config.capabilities === "object" && !Array.isArray(config.capabilities);
    case "ServeSimRunSessionRemoteConfig":
    case "WebPreviewOnlyRunSessionRemoteConfig":
      return https(config.previewUrl);
    default:
      return false;
  }
}

function summarize(session, expectedId, controller = "agent-device") {
  if (typeof controller !== "string" || !Object.hasOwn(controllers, controller) ||
      typeof expectedId !== "string" || !uuid.test(expectedId) ||
      session?.id !== expectedId || !statuses.has(session.status) ||
      !["IOS", "ANDROID"].includes(session.platform)) throw new Error();
  return {
    id: session.id,
    status: session.status,
    platform: session.platform,
    ready: session.status === "IN_PROGRESS" &&
      controllers[controller].includes(session.remoteConfig?.__typename) && hasController(session.remoteConfig),
  };
}

module.exports = { summarize };

if (require.main === module) {
  try {
    if (![3, 4].includes(process.argv.length)) throw new Error();
    const session = JSON.parse(fs.readFileSync(0, "utf8"));
    process.stdout.write(`${JSON.stringify(summarize(session, process.argv[2], process.argv[3]))}\n`);
  } catch {
    console.error("Invalid simulator status response; keep the raw result private and stop before driving.");
    process.exitCode = 1;
  }
}
