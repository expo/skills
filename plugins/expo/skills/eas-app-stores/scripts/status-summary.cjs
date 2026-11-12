const fs = require("node:fs");

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const isId = (value) => typeof value === "string" && uuid.test(value);
const statuses = new Set([
  "NEW", "AWAITING_BUILD", "IN_QUEUE", "IN_PROGRESS", "PENDING_CANCEL",
  "FINISHED", "ERRORED", "CANCELED",
]);

function summarize(job) {
  if (!job || !isId(job.id) || !statuses.has(job.status) ||
      !["IOS", "ANDROID"].includes(job.platform)) {
    throw new Error();
  }
  const summary = { id: job.id, status: job.status, platform: job.platform };
  for (const [key, value] of [
    ["projectId", job.app?.id],
    ["submittedBuildId", job.submittedBuild?.id],
  ]) {
    if (value != null) {
      if (!isId(value)) throw new Error();
      summary[key] = value;
    }
  }
  if (job.gitCommitHash != null) {
    if (typeof job.gitCommitHash !== "string" ||
        !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(job.gitCommitHash)) throw new Error();
    summary.gitCommitHash = job.gitCommitHash;
  }
  return summary;
}

try {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const expectedId = process.argv[2];
  if (process.argv.length > 3 ||
      (expectedId !== undefined && (!isId(expectedId) || input?.id !== expectedId))) {
    throw new Error();
  }
  const output = Array.isArray(input) ? input.map(summarize) : summarize(input);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch {
  console.error("Invalid EAS job response; keep the raw result private and report the status check as incomplete.");
  process.exitCode = 1;
}
