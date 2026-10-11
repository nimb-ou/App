import { renderHandoffMarkdown } from "../core/normalize.js";

const clip = (value, limit = 30000) => value.length > limit ? `${value.slice(0, limit - 24)}\n\n[Truncated by Baton]` : value;

export function toSalesforceCase(bundle, { origin = "Web" } = {}) {
  return { Subject: clip(bundle.title, 255), Description: clip(renderHandoffMarkdown(bundle)), Origin: origin };
}

export function toJiraIssue(bundle, { projectKey, issueType = "Task" } = {}) {
  if (!projectKey) throw new Error("Jira payloads need a projectKey.");
  const description = renderHandoffMarkdown(bundle);
  return {
    fields: {
      project: { key: projectKey },
      summary: clip(bundle.title, 255),
      issuetype: { name: issueType },
      description: { type: "doc", version: 1, content: description.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })) },
    },
  };
}

export function toZendeskTicket(bundle, { requesterId = undefined, priority = "normal" } = {}) {
  return { ticket: { subject: clip(bundle.title, 200), comment: { body: clip(renderHandoffMarkdown(bundle)) }, priority, ...(requesterId ? { requester_id: requesterId } : {}) } };
}

export function toSlackMessage(bundle, { bundleUrl = "" } = {}) {
  const gaps = bundle.lossAudit.filter((finding) => finding.severity === "warning");
  const text = [
    `*AI work handoff: ${bundle.title}*`,
    `${bundle.messages.length} visible messages · ${bundle.recoveredFiles.length} recovered files · ${gaps.length} warning${gaps.length === 1 ? "" : "s"}`,
    ...gaps.slice(0, 3).map((finding) => `• ${finding.title}: ${finding.detail}`),
    bundleUrl,
  ].filter(Boolean).join("\n");
  return { text: clip(text, 3500), mrkdwn: true };
}

