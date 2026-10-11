# 04: Monetisation: free to the user, paid by whoever gains

Principle: **the person moving their work never pays.** Revenue comes from the parties who *gain* when
work moves: the receiving AI vendor, the employer whose system of record fills up, the platform that wants an
"Import" button. Data is never sold. That is a hard rule and a trust moat.

## Models, ranked by fit

| # | Model | Who pays | Mechanism | Why it fits | Risks |
|---|---|---|---|---|---|
| 1 | **Destination-pays switching bounty** | AI vendors | Verified-migration API: the vendor pays $X per user who lands a Baton bundle in their product. The bundle includes a signed receipt (`bundle.root_hash` + destination ack). | Labs shipped import features within ~30 days of each other in Mar 2026. That is acquisition spend already. It mirrors telecom number portability, where the receiving side funds the move. | Neutrality perception. Mitigate by paying out to *every* destination equally and publishing the rate card. |
| 2 | **Enterprise "AI Work Record" layer** | Employers (IT, compliance, legal) | Per-seat or per-record SaaS: capture → redact → hash-chain → sink to Salesforce, ServiceNow, Jira or Zendesk, with retention policies and legal hold | Shadow AI is pervasive (Gartner: 88% use personal tools too). EU AI Act logging, SEC 17a-4, e-discovery. | Long sales cycles. Smarsh-style incumbents. Start mid-market. |
| 3 | **"Import from anywhere" widget / API** (white-label) | Platforms: agent builders, IDEs, note apps | Usage-based API (per bundle parsed) plus embeddable drop zone | Every AI product wants an "import your ChatGPT project" button and none wants to maintain parsers | Commoditisation if labs standardise. The open format makes Baton the reference implementation. |
| 4 | **Teams workspace** | Small teams and agencies | $8/user/mo: shared handoff library, review links, SSO, retention | Agencies and consultants hand AI work to clients and colleagues daily | Feature creep toward docs tools |
| 5 | **Education: AI-use disclosure receipts** | Universities | Institution licence. Students attach a tamper-evident Baton bundle as an AI-use appendix. | Policies increasingly ask for AI-use records and full logs (Princeton course-level; Newcastle appendices) ([QS Insights](https://magazine.qs.com/qs-insights-magazine-31/disclosure-or-disarray), [Trinka](https://www.trinka.ai/blog/which-universities-have-the-strictest-ai-disclosure-requirements-in-2026/)) | Must avoid surveillance framing. Student-controlled sharing only. |
| 6 | **Proof-of-work portfolios** | Freelancers (freemium upsell) | Public handoff pages showing *how* a deliverable was produced, with custom domains | Clients increasingly ask "how did you use AI?" | Small ARPU |
| 7 | **Template marketplace** | Creators (rev-share) | Handoff templates such as "PRD handoff", "research → paper", "support escalation" | Network effects | Needs scale first |
| 8 | **Sponsorships / grants** | Foundations, DTI-aligned funders | Fund the open spec and reference implementation | Public-interest portability | Not a business on its own |

**Explicitly rejected:** selling or "anonymised" licensing of conversation data, ads inside handoffs, and paywalling
export of the user's own data. Each one breaks the trust the product depends on.

## Unit sketch (illustrative, not a forecast)

- Consumer CLI, Skill and web app: about $0 marginal cost, because parsing is local or in the browser and there is no LLM call by default.
  Summarisation is done by *the destination agent* the user already pays for (see ADR-001).
- Switching bounty: if a vendor's paid-plan CAC is in the tens of dollars, a **$1–5 verified-migration fee**
  is cheap for them and sustainable for Baton at low volume.
- Enterprise: priced against compliance-archive comparables, per seat per month, with sinks as add-ons.

## Creative "free to user" mechanics

- **"Carry it forward" receipts:** each import gives the user a portable proof of what they moved. No lock-in to Baton either:
  the bundle is plain files.
- **Open spec plus certification:** vendors pay to be *"Baton-Ready"* certified, meaning they import and export bundles losslessly.
  This mirrors standards-body economics.
- **Bring-your-own-agent summarisation:** heavy LLM work runs on the user's existing subscription inside Claude Code,
  Codex or Cursor via the Skill, so Baton never needs an inference budget for free users.
