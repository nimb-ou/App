// Secret and PII redaction applied before anything leaves the user's machine.
// Conservative by design: false positives cost a little readability; false negatives leak keys.

export interface RedactionRule {
  id: string;
  label: string;
  re: RegExp;
}

export const DEFAULT_RULES: RedactionRule[] = [
  { id: 'private_key', label: 'PRIVATE KEY', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { id: 'anthropic_key', label: 'ANTHROPIC KEY', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openai_key', label: 'OPENAI KEY', re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}/g },
  { id: 'github_token', label: 'GITHUB TOKEN', re: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/g },
  { id: 'aws_access_key', label: 'AWS KEY', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'google_api_key', label: 'GOOGLE KEY', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'cloudflare_token', label: 'CLOUDFLARE TOKEN', re: /\bcf(?:at|ut|k)_[A-Za-z0-9_-]{30,}/g },
  { id: 'slack_token', label: 'SLACK TOKEN', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'stripe_key', label: 'STRIPE KEY', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g },
  { id: 'jwt', label: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { id: 'bearer', label: 'BEARER TOKEN', re: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{20,}=*/g },
  { id: 'password_assign', label: 'PASSWORD', re: /\b((?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*)(["']?)[^\s"']{6,}\2/gi },
  { id: 'email', label: 'EMAIL', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  // Cards run before phones so a Luhn-valid card is not mislabelled as a phone number.
  { id: 'card', label: 'CARD', re: /(?<![\w.-])\d(?:[ -]?\d){12,18}(?![\w.-])/g },
  // Not inside identifiers (UUIDs, hashes, version strings): no word char, dot or hyphen on either side.
  { id: 'phone', label: 'PHONE', re: /(?<![\w.-]|\d\s)\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}(?![\w.-]|\s\d)/g },
];

// Addresses that are part of software (not people) and are safe to keep.
const EMAIL_ALLOW = /^(?:noreply|no-reply|donotreply|example|user|test)@|@(?:example\.(?:com|org|net)|anthropic\.com|users\.noreply\.github\.com)$/i;

export class Redactor {
  counts: Record<string, number> = {};
  rules: RedactionRule[];
  enabled: boolean;

  constructor(enabled = true, rules: RedactionRule[] = DEFAULT_RULES, terms: string[] = []) {
    this.enabled = enabled;
    // User-supplied literal terms (names, client codenames…) run first, case-insensitively.
    const custom = terms
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
      .map((t, i): RedactionRule => ({ id: 'custom', label: `TERM${i + 1}`, re: new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi') }));
    this.rules = [...custom, ...rules];
  }

  apply(text: string): string {
    if (!this.enabled || !text) return text;
    let out = text;
    for (const rule of this.rules) {
      out = out.replace(rule.re, (match: string, ...groups: unknown[]) => {
        if (rule.id === 'email' && EMAIL_ALLOW.test(match)) return match;
        if (rule.id === 'card' && !luhn(match)) return match;
        if (rule.id === 'phone' && match.replace(/\D/g, '').length < 9) return match;
        this.counts[rule.id] = (this.counts[rule.id] ?? 0) + 1;
        const prefix = (rule.id === 'bearer' || rule.id === 'password_assign') && typeof groups[0] === 'string' ? groups[0] : '';
        return `${prefix}[REDACTED:${rule.label}]`;
      });
    }
    return out;
  }
}

function luhn(s: string): boolean {
  const digits = s.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}
