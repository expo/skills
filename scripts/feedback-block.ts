export const FEEDBACK_HEADING = "## Submitting Feedback";

export function feedbackBlock(skillName: string): string {
  return `${FEEDBACK_HEADING}
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
\`\`\`bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "${skillName}" --message "<actionable feedback>"
\`\`\`
Only submit when you have something specific and actionable to report. Include as much relevant context as possible. Messages need 40-5,000 characters.
If an \`@expo/agent-cli\` command fails, gives a wrong answer, or is hard to use, report it with \`--category agent-cli\` and the command name as \`--subject\`, such as \`status\`.
If an agent repeatedly fails at an Expo task or the user has to step in, submit a brief report of the task, expected result, and what went wrong using \`--category evals\` and the relevant Expo package or command as \`--subject\`.`;
}
