export const FEEDBACK_HEADING = "## Submitting Feedback";

export function feedbackBlock(skillName: string): string {
  return `${FEEDBACK_HEADING}
You can report problems to Expo with \`@expo/agent-cli\`:
\`\`\`bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "${skillName}" --message "<actionable feedback>"
\`\`\`
- \`--category skills\`: errors, misleading or outdated information in this skill.
- \`--category agent-cli\`: an \`@expo/agent-cli\` command fails, gives a wrong answer, or is hard to use. Use the command name as \`--subject\`, such as \`status\`.
- \`--category evals\`: an agent repeatedly fails at an Expo task, or the user has to step in. Describe the task, the expected result, and what went wrong. Use the relevant Expo package or command as \`--subject\`.

Each \`feedback\` command, in every category, sends the message to Expo. It also sends the category, the subject, the Expo project name and slug, the SDK and package versions, and the agent, CI, OS, and Node details. If the user is signed in to Expo, Expo links the report to that account.
Before each report, show the user the full message, tell them what else the command sends, and ask if they want to send it. Send it only if the user agrees. If you cannot ask the user in this run (for example, in CI, a headless run, or a subagent), do not send it. Put the proposed message in your final output instead.
Report only specific, actionable problems. Do not include secrets, tokens, personal data, or private code. Messages need 40-5,000 characters.`;
}
