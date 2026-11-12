#!/usr/bin/env node

const fs = require('node:fs');

function checkedUrl(value, origins) {
  if (typeof value !== 'string' || /[\s\x00-\x20\x7f"\\]/.test(value)) throw new Error();
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || !origins.has(url.origin)) {
    throw new Error();
  }
  return url;
}

async function downloadRecording(session, options, request = fetch) {
  const { sessionId, artifactId, artifactOrigin, storageOrigin, outputPath } = options;
  let file;
  try {
    const origins = new Set([artifactOrigin, storageOrigin]);
    for (const origin of origins) {
      if (checkedUrl(origin, origins).origin !== origin) throw new Error();
    }
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(sessionId ?? '') ||
        session?.id !== sessionId || typeof artifactId !== 'string' || !artifactId ||
        !Array.isArray(session.artifacts)) throw new Error();
    const matches = session.artifacts.filter(artifact => artifact?.id === artifactId);
    if (matches.length !== 1) throw new Error();
    let url = checkedUrl(matches[0].downloadUrl, new Set([artifactOrigin]));
    const signal = AbortSignal.timeout(600_000);
    for (let redirects = 0; ; redirects++) {
      const response = await request(url.href, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        await response.body?.cancel();
        const location = response.headers.get('location');
        if (redirects >= 5 || !location || /[\s\x00-\x20\x7f"\\]/.test(location)) throw new Error();
        url = checkedUrl(new URL(location, url).href, origins);
        continue;
      }
      if (response.status !== 200 || !response.body) {
        await response.body?.cancel();
        throw new Error();
      }
      let header = Buffer.alloc(0);
      for await (const chunk of response.body) {
        if (file === undefined) {
          header = Buffer.concat([header, chunk]);
          if (header.length < 12) continue;
          // MP4 files start with an ISO base media file type box, not an HTML redirect body.
          if (header.toString('ascii', 4, 8) !== 'ftyp') throw new Error();
          file = fs.openSync(outputPath, 'wx', 0o600);
          fs.writeFileSync(file, header);
        } else {
          fs.writeFileSync(file, chunk);
        }
      }
      if (file === undefined) throw new Error();
      fs.closeSync(file);
      return;
    }
  } catch {
    if (file !== undefined) {
      fs.closeSync(file);
      fs.rmSync(outputPath, { force: true });
    }
    throw new Error('Recording recovery failed; verify the session, storage origins, and recording before retrying.');
  }
}

module.exports = { downloadRecording };

if (require.main === module) {
  const [sessionId, artifactId, artifactOrigin, storageOrigin, outputPath] = process.argv.slice(2);
  Promise.resolve().then(() => downloadRecording(JSON.parse(fs.readFileSync(0, 'utf8')),
    { sessionId, artifactId, artifactOrigin, storageOrigin, outputPath }))
    .catch(() => {
      console.error('Recording recovery failed; verify the session, storage origins, and recording before retrying.');
      process.exitCode = 1;
    });
}
