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

This command sends the message to Expo. Before you run it, show the user the full message and ask if they want to send it. Send it only if the user agrees. If there is no user to ask, do not send it.
Report only specific, actionable problems. Do not include secrets, tokens, personal data, or private code. Messages need 40-5,000 characters.`;
}
