// Opt-in delivery of sink payloads. Credentials come only from environment variables; nothing is stored.

import type { SinkPayload } from '../sinks/index.ts';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export interface PostResult {
  ok: boolean;
  status: number;
  url: string;
  response: string;
}

export async function postSink(p: SinkPayload): Promise<PostResult> {
  let url: string;
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  let body = p.body;
  switch (p.sink) {
    case 'salesforce':
      url = need('SALESFORCE_INSTANCE_URL').replace(/\/$/, '') + p.path;
      headers.authorization = `Bearer ${need('SALESFORCE_ACCESS_TOKEN')}`;
      break;
    case 'jira': {
      url = need('JIRA_BASE_URL').replace(/\/$/, '') + p.path;
      headers.authorization = `Basic ${btoa(`${need('JIRA_EMAIL')}:${need('JIRA_API_TOKEN')}`)}`;
      const project = process.env.JIRA_PROJECT;
      const json = JSON.stringify(body);
      if (json.includes('${JIRA_PROJECT}')) {
        if (!project) throw new Error('Set JIRA_PROJECT or pass --jira-project');
        body = JSON.parse(json.replace('${JIRA_PROJECT}', project));
      }
      break;
    }
    case 'zendesk':
      url = `https://${need('ZENDESK_SUBDOMAIN')}.zendesk.com${p.path}`;
      headers.authorization = `Basic ${btoa(`${need('ZENDESK_EMAIL')}/token:${need('ZENDESK_API_TOKEN')}`)}`;
      break;
    case 'slack':
      url = need('SLACK_WEBHOOK_URL');
      break;
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, url: url.replace(/(hooks\.slack\.com\/services\/)\S+/, '$1…'), response: (await res.text()).slice(0, 2000) };
}
