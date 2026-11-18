export const FEEDBACK_HEADING = "## Submitting Feedback";

export function feedbackBlock(skillName: string): string {
  return `${FEEDBACK_HEADING}
If this skill has an error, or misleading or outdated information, tell the user and offer to report it to Expo. A report is optional, and the user decides. Do not send a report before the user agrees.
The \`feedback\` command of the agent CLI sends a report. Its \`--help\` lists the categories (\`skills\` with the subject "${skillName}", \`agent-cli\` for a problem with the agent CLI, \`evals\` when an agent repeatedly fails at an Expo task) and the data that a report sends. Show the user the message, and tell the user that the report also carries project and environment details. If you cannot ask the user, put the command with your message in your final summary, so the user can send it. Do not include secrets or personal data.`;
}
