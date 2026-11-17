export const FEEDBACK_HEADING = "## Submitting Feedback";

export function feedbackBlock(skillName: string): string {
  return `${FEEDBACK_HEADING}
You can voluntarily report errors, misleading or outdated information in this skill, so Expo can improve it:
\`\`\`bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "${skillName}" --message "<actionable feedback>"
\`\`\`
Use \`--category agent-cli\` for a problem with the agent CLI, and \`--category evals\` when an agent repeatedly fails at an Expo task. Run \`feedback --help\` for subjects and the data that the command sends.
Each report goes to Expo with project and environment details. Show the user the message, and send it only if the user agrees. If you cannot ask the user, do not send it. Do not include secrets or personal data.`;
}
