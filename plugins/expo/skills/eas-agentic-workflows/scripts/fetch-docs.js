#!/usr/bin/env node
// Fetch one agentic-workflows guide as markdown from docs.expo.dev.
// Prints the page on stdout and `source: <url>` on stderr.

const SLUGS = ['introduction', 'setup', 'agentic-ci', 'issue-to-pr', 'bug-triage', 'qa-swarm'];

// docs/pages/agentic-workflows/ and the guides' paste prompts use this path.
const DOCS_BASE = 'https://docs.expo.dev/agentic-workflows';

function looksLikeGuide(text) {
  if (!text || text.length < 400) return false;
  const start = text.trimStart().slice(0, 200).toLowerCase();
  if (start.startsWith('<!doctype') || start.startsWith('<html')) return false;
  return /agentic workflow|expo simulators|agentic ci|qa swarm/i.test(text);
}

async function main() {
  const slug = process.argv[2];
  if (!SLUGS.includes(slug)) {
    console.error(`Usage: node fetch-docs.js <${SLUGS.join('|')}>`);
    process.exit(2);
  }

  const url = `${DOCS_BASE}/${slug}.md`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Could not fetch ${url} (HTTP ${response.status}).`);
      process.exit(1);
    }
    const text = await response.text();
    if (!looksLikeGuide(text)) {
      console.error(`Could not fetch ${url}. The response was not the guide.`);
      process.exit(1);
    }
    console.error(`source: ${url}`);
    process.stdout.write(text.endsWith('\n') ? text : `${text}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not fetch ${url}. ${message}`);
    process.exit(1);
  }
}

main();
