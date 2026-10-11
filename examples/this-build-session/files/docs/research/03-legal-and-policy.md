# 03: Legal, policy and trust considerations

*Not legal advice. This doc records the design constraints the build follows and why.*

## 1. Is it legitimate to read a share link?

- A share link is **published by its owner** to anyone with the URL. Baton fetches **one URL the user supplies**,
  the same way a browser would. It does not crawl, enumerate share IDs, bypass authentication or defeat
  rate limits. **Design rule: one user-supplied URL per request, no discovery and no bulk scraping.**
- The web app also works **without fetching at all**. The user saves the page ("Save as…") or downloads the
  official export, and Baton parses it **in the browser**. Nothing leaves the device.
- The user's own data exports are theirs to use. Baton only reads what the user provides.

## 2. Data-portability law (why an open format matters)

- **GDPR Art. 20** gives a right to receive personal data *provided by* the data subject in a "structured,
  commonly used and machine-readable format", and Recital 68 adds "interoperable" ([Art. 20 text](https://advisera.com/gdpr/right-to-data-portability/),
  [Recital 68](https://presencis.com/regulations/gdpr/recital-68/)). Prompts are clearly in scope. Whether *model outputs*
  are "provided by" the user is **unsettled** ([analysis](https://www.iiprd.com/?p=14136)).
- **DTI** calls AI assistants a priority portability area and piloted an AI export format with Inflection AI
  ([DTI DMA response](https://dtinit.org/assets/DTI-Response-to-DMA-One-Year-Review.pdf),
  [CDT](https://cdt.org/insights/dont-let-perfect-be-the-enemy-of-portable/)).
  **Opportunity:** publish the Baton bundle schema as an open spec and offer it to DTI as a candidate interoperable format.

## 3. Records, audit and retention (business layer)

- **EU AI Act Art. 12 / 19 / 26(6):** automatic event logging for high-risk systems, with deployer log retention of at least
  six months. Commentators place the application date at 2 Aug 2026 and stress integrity against silent alteration
  ([Help Net Security](https://www.helpnetsecurity.com/2026/04/16/eu-ai-act-logging-requirements/),
  [FireTail via Security Boulevard](https://securityboulevard.com/2026/04/article-12-and-the-logging-mandate-what-the-eu-ai-act-actually-requires-firetail-blog/)).
  Verify the date against EUR-Lex, because the digital-omnibus proposals may shift it.
- **SEC 17a-4 / FINRA:** Smarsh markets ChatGPT Enterprise and Copilot capture for these obligations
  ([Smarsh](https://www.smarsh.com/channel/chatgpt-enterprise)).
- **E-discovery:** AI chat logs are discoverable. In *NYT v. OpenAI* the court ordered preservation (May 2025),
  modified it (Oct 2025) and ordered production of 20M anonymised logs (Nov 2025)
  ([Duane Morris](https://blogs.duanemorris.com/classactiondefense/2025/10/27/new-york-federal-courts-openai-discovery-orders-provide-key-insights-for-companies-navigating-ai-preservation-standards/),
  [terms.law](https://terms.law/2025/11/12/openai-v-new-york-times-stopped-being-just-a-copyright-case-the-moment-the-court-turned-to-your-chatgpt-logs/)).

**Design consequence:** each bundle carries a **SHA-256 hash chain** over its normalised events plus a root
hash, so any later edit is detectable. This gives *tamper-evidence*, not *tamper-proofing*. Proofing would need
WORM storage or external anchoring, which belongs to the enterprise tier.

## 4. Privacy defaults

| Default | Why |
|---|---|
| **Redaction on by default** for emails, phone numbers, API keys and tokens (`sk-…`, `ghp_…`, AWS keys, JWTs, bearer tokens), and private keys | Handoffs get pasted into other tools and repos. Secrets in AI chats are common. |
| Hidden or system messages **excluded** unless `--include-hidden` | They can contain memory or profile data the user never saw |
| Local-first: CLI, Skill and MCP all run on the user's machine. The web app parses in the browser. | No server copy, so no breach surface and no lawful-access target |
| Generated replay scripts are **never executed automatically** | They contain third-party code from another AI's sandbox |

## 5. Trademarks

Vendor names (ChatGPT, Claude, Gemini, Salesforce, Jira, Zendesk, Slack) appear only to name *formats and
integrations*. There is no logos-as-branding and no implied endorsement. The product name **Baton** is generic. A clash
check before any commercial launch is listed in the roadmap.
