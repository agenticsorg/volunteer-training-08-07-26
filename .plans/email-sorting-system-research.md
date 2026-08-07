# Cross-Platform Email Triage & Classification System — Research Report

**Context:** Deep research for planning a cross-platform (Gmail + Outlook) email sorting/triage system covering these categories: newsletters, job postings, social, e-commerce, sales & deals, LinkedIn, meeting cancellations, needs-a-reply, prioritization, phishing attempts, and personal contacts.

---

# Research Report: Cross-Platform Email Triage & Classification System (Gmail + Outlook)

*Compiled 2026-08-07. All claims sourced from web search; evidence quality noted where uncertain.*

---

## 1. Platform APIs & Native Capabilities

### 1.1 Gmail API

| Capability | Details |
|---|---|
| **Native tab categories** | Gmail's ML already buckets mail into `CATEGORY_PERSONAL`, `CATEGORY_SOCIAL`, `CATEGORY_UPDATES`, `CATEGORY_FORUMS`, `CATEGORY_PROMOTIONS` — these are special system labels, distinct from user labels, and can be set via the `"Categorize as"` filter action. A message can carry a category label *and* custom labels simultaneously. |
| **Labels/filters** | Full CRUD via `users.labels` and `users.settings.filters`. Filters support `from`, `to`, `subject`, `hasWords`, header matches, and actions (`addLabelIds`, `removeLabelIds`, forward, mark-read, never-spam). No native "meeting cancellation" or "phishing" filter primitive — must be built externally. |
| **Push notifications** | `users.watch()` + Google Cloud Pub/Sub delivers near-real-time change notifications (new mail, label changes). **Must renew every 7 days** (watch expires). Effectively ~1 event/sec/user cap on delivered notifications, so bursts get coalesced — a `historyId` diff pull is needed on notify to get the actual message deltas. |
| **Quotas** | 1,000,000,000 quota units/day (project-wide), 250 quota units/user/second (moving average, allows short bursts). `messages.get` ≈ 5 units, `messages.list` ≈ 5, `messages.modify` ≈ 5 — so per-user throughput is generous for a triage bot but must be rate-limited to avoid HTTP 429. |
| **OAuth scopes** | `gmail.readonly` (read-only), `gmail.modify` (labels/read, no delete/send), `gmail.labels`, full `mail.google.com` (broad). Prefer `gmail.modify` + `gmail.labels` — avoids the highest-sensitivity scope. Apps requesting sensitive scopes for >100 users need Google's OAuth verification (CASA security assessment for "restricted" scopes touching mail content). |
| **People API** | Separate API (`people.googleapis.com`) for contacts and "Other contacts" (auto-collected from interactions). Useful signal for personal-contact detection, but the API itself does **not** expose an "interaction frequency" score — that must be derived by the app from Gmail message history. |

**Source:** [Gmail labels API – Nylas](https://developer.nylas.com/docs/cookbook/email/gmail-labels-api/), [Gmail push notifications guide](https://developers.google.com/workspace/gmail/api/guides/push), [Gmail API push notifications – Unipile](https://www.unipile.com/gmail-api-push-notifications/), [People API](https://developers.google.com/people/api/rest), [OAuth scopes for email – Nylas](https://cli.nylas.com/guides/oauth-scopes-for-email-explained)

### 1.2 Microsoft Graph API (Outlook / M365)

| Capability | Details |
|---|---|
| **Mail folders** | Well-known folders (`Inbox`, `Drafts`, `SentItems`, `DeletedItems`) plus arbitrary custom folders via `/me/mailFolders`. Moving a message to a folder is a first-class, native way to "sort" mail (unlike Gmail's label-only model). |
| **Message rules** | `GET/POST /me/mailFolders/inbox/messageRules` — native server-side rules engine: move-to-folder, assign category, set importance, forward, stop-processing, based on subject/sender/keyword conditions. Can offload simple heuristic rules (e.g., LinkedIn sender → LinkedIn folder) directly to Outlook's rule engine instead of custom infra. |
| **Categories** | Categories API (`/me/outlook/masterCategories`) manages a shared color-coded tag taxonomy; `message.categories` is a settable array property — a natural fit for multi-label tagging (a message can be both "Needs Reply" and "VIP"). |
| **Focused Inbox** | Native ML classifier splits Focused vs. Other via `inferenceClassification` property per message, with `inferenceClassificationOverride` to pin senders. This overlaps with prioritization goals but is binary, not a full VIP/urgency score — still useful as one input signal. |
| **Webhooks/subscriptions** | Change notifications via `/subscriptions` (webhook push). **No guaranteed delivery** — must combine with delta queries (`/me/messages/delta`) as a reconciliation backstop. Subscriptions must be renewed periodically (max lifetime varies by resource, ~4230 min / ~3 days for messages). |
| **Throttling** | ~10,000 requests/10 min per app per mailbox for mail endpoints; subscription CRUD limited to 500 requests/20 sec per app per tenant; global ceiling 130,000 req/10 sec per app across all tenants. 429 responses include `Retry-After` — implement exponential backoff + jitter. |
| **OAuth scopes** | `Mail.Read`, `Mail.ReadWrite`, `MailboxSettings.ReadWrite` (for rules/categories). Delegated vs. application permissions matter: application permissions (daemon/service scenario) need admin consent and are higher-blast-radius than delegated per-user consent. |

**Source:** [Outlook mail API overview](https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview), [List rules](https://learn.microsoft.com/en-us/graph/api/mailfolder-list-messagerules?view=graph-rest-1.0), [Focused Inbox resource](https://learn.microsoft.com/en-us/graph/api/resources/manage-focused-inbox?view=graph-rest-1.0), [Graph throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits)

### 1.3 Native vs. Custom — Comparison

| Need | Gmail native | Outlook native | Requires custom build |
|---|---|---|---|
| Newsletters/Promotions | Partial (Promotions tab) | No | Yes (refine boundary, add sub-categories) |
| Social | Partial (Social tab) | No | Yes, and to split out **LinkedIn** specifically |
| E-commerce | Folded into Updates tab | No | Yes |
| Sales & deals | Folded into Promotions | No | Yes (distinct from generic newsletters) |
| Meeting cancellations | No | Partial (calendar auto-processes ICS, but no "flag cancellation emails" primitive) | Yes |
| Needs a reply | No | Partial (Focused Inbox ≈ "important", not "awaiting reply") | Yes |
| Prioritization/VIP | No (Priority Inbox deprecated as end-user feature; no API) | Partial (Focused/Other binary; per-sender override) | Yes, richer tiering |
| Phishing | Yes, server-side (both platforms run their own filters before delivery) | Yes, stronger with Defender for Office 365 add-on | Optional supplementary layer |
| Personal contacts | No explicit signal; People/Contacts API only | No explicit signal | Yes, derive from headers + interaction graph |
| LinkedIn (vs. generic social) | No | No | Yes |

**Confidence:** High for documented API capabilities (official Microsoft Learn / Google Developers docs); medium for "what's folded into which native tab" claims, which come from secondary blog sources rather than Google's own tab-classification spec (Google doesn't publish the exact algorithm).

---

## 2. Classification Approaches

### 2.1 Rule-based / heuristic signals (cheap, deterministic, auditable)

These give near-100% precision for specific categories and should form the first pass of any pipeline:

- **Sender domain / envelope-from** — exact-match or pattern-match against known domains (e.g., `*.linkedin.com`, `*-noreply@*`, e-commerce carriers like `shipment-tracking@amazon.com`).
- **`List-Unsubscribe` header** (RFC 2369 / RFC 8058) — near-definitive signal of bulk/newsletter mail. As of Feb 2024, Gmail/Yahoo *require* one-click unsubscribe (RFC 8058 `List-Unsubscribe-Post`) for senders doing 5,000+ msgs/day, so its presence is now even more reliable as a "this is bulk mail" flag. Its *absence* on a promo-looking email is a mild red flag (possible non-compliant spam).
- **`Precedence: bulk` / `Auto-Submitted: auto-generated` / `List-Id`** headers — RFC 3834-defined signals for automated/non-personal mail. `Auto-Submitted` is the more modern, reliable one; `Precedence: bulk` is legacy but still widely set. Absence of *all* of these, combined with a normal-looking `From` (not `noreply@`) and DKIM alignment to a personal-looking domain, is a strong **personal contact** signal.
- **SPF/DKIM/DMARC pass-fail** — used both for phishing scoring and for authenticity-boosting legitimate transactional/newsletter senders.
- **`Content-Type: text/calendar; method=CANCEL`** — deterministic detection of meeting cancellations. Filters can literally check the MIME part content-type prefix and search the ICS body for `METHOD:CANCEL` / `STATUS:CANCELLED`. Caveat: different calendar clients are inconsistent about including `SEQUENCE` bumps, so pure string-matching is more robust across providers than relying on calendar-app semantics.
- **Schema.org / JSON-LD email markup** (`Order`, `ParcelDelivery`, `Invoice`, `EventReservation`) — many e-commerce senders (especially larger ones, using Gmail's "Email Markup"/schema.org registration) embed structured JSON-LD directly in the HTML. Where present, this is a highly reliable, semantically rich signal for the e-commerce category (order number, price, delivery status) — far better than keyword matching.
- **Keyword/regex heuristics** — subject-line patterns ("Your order has shipped", "Connection request", "Job alert:", "URGENT: Action required") — lowest precision, best used as a weak signal feeding a scorer rather than a hard rule.

### 2.2 ML/NLP approaches

| Approach | Notes |
|---|---|
| Classical (Naive Bayes/SVM on TF-IDF, bag-of-words) | Still used for spam-style filtering (SpamAssassin's Bayesian module); cheap, fast, works well with abundant labeled data but weak on semantics and multi-label nuance. |
| Word embeddings + classifier | word2vec / Sentence-BERT (SBERT) embeddings feeding a lightweight classifier or even unsupervised clustering (K-Means) for coarse sorting; a reasonable middle tier. |
| Deep learning (LSTM/BiGRU/CNN hybrids) | Context-LSTM-CNN and BiGRU/BiLSTM models show good results in literature but require training data and MLOps investment most small teams won't want to carry. |
| LLM-based (zero/few-shot, structured output) | Increasingly the dominant 2025–2026 approach for exactly this kind of task — no training pipeline, handles nuance/multi-label naturally, and adapts to new categories via prompt changes rather than retraining. |

**Evidence quality:** Medium — most of these findings come from single papers/surveys (Springer, MDPI, arXiv) rather than large-scale industry benchmarks specific to *email* triage; treat comparative accuracy numbers as illustrative, not authoritative for this exact 11-category taxonomy.

### 2.3 LLM as classifier — practical design points

- **Multi-label prompting**: Few-shot examples materially improve F1 for multi-label classification; research suggests **~5 examples per label category** is close to the point of diminishing returns for cost vs. accuracy, and using single-label (unambiguous) examples in the few-shot set outperforms ambiguous multi-label examples.
- **Structured output**: Constrain output to a JSON schema / enum of the 11 categories + confidence + reasoning-free short justification. This is standard practice now (tool-use / structured-output mode) rather than parsing free text.
- **Cost/latency control — "cheap-first, LLM-as-fallback"**: The dominant 2025–2026 industry pattern is a tiered pipeline: (1) heuristics resolve the easy majority (high confidence, near-zero cost) → (2) a cheap/fast model (e.g., Haiku-class) handles the bulk of the remainder → (3) an expensive frontier model or human review handles only the genuinely ambiguous tail. One cited industry rule of thumb: if a cheap model resolves 70% correctly and the expensive model costs 12x more, routing only the residual 30% to the expensive model costs ~4.6x the cheap-only price — well under half of running everything through the expensive model. Applied here: rules should resolve e-commerce/newsletter/LinkedIn/meeting-cancellation with near-100% confidence for the majority of volume; an LLM step is reserved for "needs a reply," nuanced prioritization, ambiguous sales-vs-newsletter boundary cases, and phishing edge cases rules don't catch.
- **Anthropic-specific costs (as of Aug 2026)**: Claude's Batch API gives a 50% discount on input/output tokens for async (within-24h) jobs — a strong fit for a nightly/periodic reclassification sweep or backlog triage, vs. interactive real-time triage which would use standard (non-batch) pricing. Haiku-class models are explicitly positioned by Anthropic-ecosystem sources for classification/extraction workloads; reserve Sonnet/Opus-class for cases needing deeper reasoning (e.g., distinguishing a sophisticated spear-phishing attempt from a legitimate but urgent business email).

**Source:** [List-Unsubscribe header — Litmus](https://www.litmus.com/blog/the-ultimate-guide-to-list-unsubscribe), [GMass on List-Unsubscribe](https://www.gmass.co/blog/list-unsubscribe-header/), [Precedence/Auto-Submitted headers explained](https://reviewmyemails.com/emailalmanac/esp-and-infrastructure/message-mechanics-mime-attachments-list-unsubscribe/precedence-bulk-auto-submitted-headers), [RFC 3834 summary](https://www.mailertogo.com/rfc/3834), [iCalendar METHOD:CANCEL / MIME parsing](https://www.tarlogic.com/blog/abusing-calendar-processing/), [Order schema.org](https://schema.org/Order), [Email schema markup guide](https://www.emailonacid.com/blog/article/email-development/schema-markup-gmail/), [Few-shot multi-label LLM classification](https://medium.com/@alexandrdzhumurat/smarter-multi-label-predictions-with-adaptive-few-shot-prompting-2b3da7e08239), [Evaluating LLMs for multi-label text classification](https://www.researchgate.net/publication/397610881_Evaluating_LLMs_for_Multi-label_Text_Classification), [LLM inference cost optimization](https://www.gmicloud.ai/en/blog/llm-inference-cost-optimization-caching-batching-routing), [Claude API pricing 2026](https://www.cloudzero.com/blog/claude-pricing/), [Claude batch/caching cost optimization](https://pecollective.com/tools/claude-pricing-guide/)

### 2.4 Detecting "needs a reply"

Academic and product literature converges on a hybrid signal set:
- **Question/interrogative detection** in the message body (explicit `?`, interrogative phrasing, imperative "please advise/confirm/let me know").
- **Deadline/time-word detection** ("by Friday", "EOD", "ASAP") correlating urgency with actionability.
- **Sender-hierarchy/politeness framing** — polite requests from superiors are recognized as implicit commands/requests, not just literal questions (an LLM handles this far better than regex).
- **Negative filtering** — explicitly excluding automated notifications, FYI broadcasts, receipts, and newsletters *before* running reply-detection, since these are structurally never "needs reply" regardless of content.
- **Thread-state signal**: if the email is the latest message in a thread and the user hasn't sent a subsequent message in that thread, that's a strong structural "awaiting reply" signal independent of content — likely the single highest-precision heuristic available, and works identically on Gmail (`threadId`) and Outlook (`conversationId`).

This is one of the harder categories to get right with rules alone — recommend LLM/NLP as primary method, gated by the automated-sender exclusion rules from §2.1 to cut volume first.

**Source:** [Detecting emails containing requests for action (ACL)](https://aclanthology.org/N10-1142.pdf), [Question-Answer pair detection in email](http://www.cs.columbia.edu/nlp/papers/2004/shrestha_mckeown_04.pdf), [AI email analysis overview](https://docs.enterprise.emailmeter.com/ai-features/overview)

### 2.5 Prioritization / urgency scoring

- Modern commercial scorers (per one detailed source) compute a 0–100 score from **four weighted signals**: urgency language, revenue/business risk, deadline proximity, and sender importance — starting from a base score and adjusting per signal, rather than a single VIP/non-VIP binary.
- **Pure VIP-list approaches have a known blind spot**: they treat every message from a VIP identically regardless of content, and they cannot catch *new* important senders (new client, new deal) who aren't yet on the list — this is explicitly called out as a limitation in industry sources, arguing for content-aware scoring over static lists.
- Recommended composite signal set for this system: (a) static/dynamic VIP list (manually curated + auto-promoted based on reply-frequency), (b) historical interaction frequency (derived from Gmail/Graph message history — how often the user replies to this sender), (c) content-based urgency (keyword/deadline detection or LLM judgment), (d) calendar proximity (an email referencing a meeting happening within N hours), (e) "needs a reply" flag itself as an input to prioritization (unanswered + old = escalate).

**Source:** [Priority scoring signals](https://www.getmailbird.com/build-priority-email-system-process-inbox-faster/), [VIP prioritization limitations](https://dailytaskproai.com/blog/how-to-prioritize-emails-automatically), [Gmail Priority Inbox](https://support.google.com/a/users/answer/11349123?hl=en)

**Evidence quality note:** the specific "4-signal, 0–100 score" architecture comes from a single marketing/product blog, not a peer-reviewed or platform-official source — treat as one plausible design pattern to validate against your own data, not a proven formula.

### 2.6 Detecting personal contacts vs. automated senders

Converging signal set (from §2.1 plus this search): **absence** of `List-Unsubscribe`, `Precedence: bulk`, `Auto-Submitted`, `List-Id` headers; a `From` address that is not a `noreply@`/`notifications@`/`no-reply@` pattern; presence in the user's People/Contacts API results or "Other contacts" (auto-collected); bidirectional thread history (user has sent mail *to* this address before, not just received); and a personal-looking display name (heuristic, lower confidence). No single header is fully reliable — combine as a weighted rule/score rather than a hard gate, since some real people send from role accounts and some automated systems don't set the RFC 3834 headers correctly.

---

## 3. Phishing / Security Detection

### 3.1 Core authentication-based detection

- **SPF** — DNS-published list of authorized sending IPs for a domain.
- **DKIM** — cryptographic signature verifying message integrity/origin.
- **DMARC** — policy layer (`p=none|quarantine|reject`) built on SPF+DKIM alignment, plus aggregate/forensic reporting. As of 2025, **Google, Yahoo, and Microsoft require proper SPF/DKIM/DMARC for bulk senders**, which raises the baseline reliability of "fails all three" as a phishing signal for high-volume senders (spoofers targeting your domain are more likely to fail alignment now that legitimate bulk mail is expected to pass).
- A message failing DMARC alignment while impersonating a known brand (display-name spoofing, e.g., "PayPal Support" from a random Gmail address) is one of the highest-value, cheapest-to-compute phishing signals.

### 3.2 Lookalike/typosquat domain detection

- Attackers substitute characters (`rn`→`m`), swap TLDs (`.co` for `.com`), or append words (`amazon-security.com`). Zscaler ThreatLabz (2024) found **30,000+ lookalike domains** targeting just the top 500 sites, **10,000+ confirmed malicious** — this is an active, large-scale technique, not a theoretical risk.
- **DMARC alone does not catch this** — a lookalike domain the attacker registers and legitimately authenticates (its own SPF/DKIM/DMARC, self-consistent) will pass authentication checks while still being fraudulent. This *requires* a separate check: string-distance / homoglyph comparison of the sender domain against (a) a brand watchlist and (b) domains the user has actually corresponded with before.
- Defensive registration and certificate-transparency-log monitoring are enterprise-side mitigations (not directly applicable to an inbox-triage tool, but useful context for why lookalikes keep appearing).

### 3.3 Threat-intel APIs / existing detection layers

- **Microsoft Defender for Office 365** — native anti-phishing runs *before* delivery: attachment detonation (sandboxing), URL analysis, Safe Links (rewrites + time-of-click re-verification, meaning even a link that was safe at send-time gets re-checked when clicked later). This substantially reduces the phishing surface a custom layer needs to cover for Outlook — the highest-value addition is post-delivery, content-based signals (urgency language, financial-request framing) Defender may not flag as outright malicious but which are classic BEC (business email compromise) patterns.
- **Google Safe Browsing API / VirusTotal** — useful for supplementary URL/attachment-hash reputation checks in a custom pipeline; no evidence found of a single unified integration point across all three (Safe Browsing, VirusTotal, Defender) — these would need to be wired together independently if used as a defense-in-depth layer beyond native platform filtering.
- **LLM-based phishing intent classification** — a 2025 paper (arXiv:2506.14337, "LLM-Powered Intent-Based Categorization of Phishing Emails") demonstrates LLMs classifying phishing by **intent** (credential harvesting, BEC, malware delivery, etc.) using only the visible email text — addressing a specific gap: traditional detectors lean on metadata invisible to end users, while experienced humans (and apparently LLMs) can often flag phishing from text/framing alone. This is directly relevant: an LLM step reading the email body for urgency/authority/financial-request framing is a good complement to header/domain-based rules, not a replacement.

**Recommended layering for this system**: (1) trust platform-native filtering as the first line (both Gmail and Outlook already block/flag the most obvious phishing before your pipeline even sees it) → (2) header/DMARC-alignment + lookalike-domain scoring as fast custom checks → (3) LLM intent classification for the residual "looks legitimate but something's off" tail, especially for BEC-style attacks that pass all technical authentication checks because they come from a genuinely compromised or freshly-registered but authenticated domain.

**Source:** [SPF/DKIM/DMARC 2025 requirements](https://mailfloss.com/spf-dkim-dmarc-email-authentication-setup-guide/), [Email authentication protocols 2025](https://www.emailonacid.com/blog/article/email-deliverability/email-authentication-protocols/), [Lookalike domain detection — Breachsense](https://www.breachsense.com/typosquatting/), [Lookalike domains — Valimail](https://www.valimail.com/blog/how-to-detect-lookalike-domains/), [Defender for Office 365 Safe Links](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about), [Anti-phishing policies M365](https://learn.microsoft.com/en-us/defender-office-365/anti-phishing-policies-about), [LLM-Powered Intent-Based Categorization of Phishing Emails (arXiv:2506.14337)](https://arxiv.org/abs/2506.14337)

---

## 4. Existing Tools & Prior Art

| Tool | Categorization approach | Relevance |
|---|---|---|
| **SaneBox** | Learns which senders you engage with; routes low-value mail to a "SaneLater" folder for batch review. Filtering-layer-on-top-of-existing-client model (not a client replacement). Longest track record (since 2011). | Closest prior art to a "sits on top of Gmail/Outlook via API, applies folders/labels" architecture. |
| **Clean Email** | Bulk sorting, sender/group-based Smart Folders, automated cleanup rules — rule/heuristic-driven, not LLM-driven. | Good reference for the rule-engine side of a hybrid design. |
| **Superhuman / Shortwave** | Full client replacement (not API-layer) with keyboard-driven triage, AI splits/bundles. Shortwave in particular does Gmail-native AI bundling. | Reference for UX of triage, not for the API-integration architecture. |
| **Missive** | Combines email/chat/tasks; integrates GPT for reply generation; documents its own "Gmail smart categories" handling. | Shows a real-world integration surface with Gmail's native category labels. |
| **EmailTree.ai** | NLP-based intent classification (request/complaint/question/order) for routing to departments — B2B/helpdesk-oriented rather than personal-inbox-oriented, but the intent-taxonomy approach is directly analogous to the 11-category taxonomy here. | Closest prior art for the *classification* half specifically. |
| **Mailstrom** | Bulk-action/analytics focus, less about per-message categorization. | Lower relevance. |

### Open-source components

- **Talon (Mailgun)** — Python library for reply/quote/signature extraction from email bodies (heuristics + ML only for signature-line classification). Useful as a preprocessing step so classifiers see the *actual new content* of a reply, not quoted history — directly relevant to both "needs a reply" detection and reducing token count for LLM classification. Reported signature-detection accuracy in complex cases is modest (~25–30%), so treat it as a helpful heuristic, not a solved problem.
- **SpamAssassin** — mature, huge third-party rule ecosystem (KAM, SARE rulesets), Bayesian filtering, DNSBL integration. Good reference implementation for the "many independent scored heuristics summed into a threshold" pattern, directly transferable to a general classification scorer (not just spam).
- **Rspamd** — modern successor/alternative to SpamAssassin; can import SpamAssassin-format rules for gradual migration; combines heuristics with ML; positioned as the current (2026) default choice for new mail infrastructure. If self-hosting any spam/phishing pre-filtering rather than relying solely on Gmail/Outlook's native filtering, Rspamd is the stronger current option.
- **Zapier/Make/Power Automate** — no-code integration layer; Zapier's built-in Email Parser + AI extraction can pull category/urgency from emails and can set Outlook/O365 categories directly. Useful as a *fast prototype* path (validate the taxonomy and rules before building custom infra) but has known limits (breaks on sender reformatting, no OCR, simple text parsing only) — not recommended as the production backbone for an 11-category, phishing-aware system.

**Source:** [SaneBox vs Superhuman comparison](https://www.usecarly.com/blog/superhuman-vs-sanebox/), [Best AI email management tools 2026](https://unboxd.ai/blog/best-ai-email-tools.html), [EmailTree AI classification](https://emailtree.ai/ai-email-classification/), [Missive Gmail smart categories](https://missiveapp.com/docs/core-features/connected-accounts/email-accounts/gmail-google-workspace/using-gmail-smart-categories), [Talon GitHub](https://github.com/mailgun/talon/), [SpamAssassin](https://spamassassin.apache.org/), [Rspamd](https://rspamd.com/), [Open source anti-spam comparison 2026](https://portalzine.de/open-source-anti-spam-tools-in-comparison-for-an-ai-world/), [Zapier Email Parser](https://zapier.com/blog/email-parser-guide/)

---

## 5. Architecture Options

### 5.1 Integration surface: add-in vs. middleware vs. desktop agent

| Option | Pros | Cons |
|---|---|---|
| **Gmail Add-on (Apps Script/CardService) / Outlook Add-in** | Runs inside the native client UI (web + mobile for Gmail); no separate app to open; can act on the currently-open message. | Two entirely separate codebases/platforms (Apps Script vs. Office.js); limited background/batch processing (add-ins are largely interaction-triggered, not well-suited to continuously triaging an entire inbox in the background); harder to run heavy classification pipelines. |
| **Server-side middleware (OAuth + REST API)** | Single backend serves both platforms behind a common internal model; can run continuously (poll/webhook), do heavy batch classification, apply labels/folders/categories via API without any client-side code; easiest to add an LLM step server-side. | Requires hosting infrastructure; must handle OAuth token lifecycle, webhook renewal, and both platforms' quirks (labels vs. folders) in one normalization layer. |
| **Local/desktop background agent** | No hosting cost; data stays on-device (privacy win); can use local models for cheap tiers. | Harder to keep running reliably (needs to survive sleep/reboot); syncing state across the user's multiple devices is awkward; still needs OAuth for API access regardless of "local" framing. |

**Recommendation**: given the requirement to support **both** Gmail and Outlook with a shared 11-category taxonomy, a **server-side middleware service** is the clear fit — it lets you build one normalized ingestion + classification pipeline and two thin platform adapters (Gmail label-application, Outlook folder/category-application), rather than duplicating classification logic inside two incompatible add-in runtimes.

### 5.2 Real-time vs. batch

- **Real-time (webhook/push-triggered)**: Gmail `watch()`+Pub/Sub and Graph `/subscriptions` both support this, but neither guarantees delivery (Graph explicitly documents no delivery guarantee; Gmail's push is rate-limited to ~1 evt/sec/user and requires re-derivation via `historyId`). **Both require a periodic reconciliation poll/delta-sync as a backstop** regardless of webhook use — webhooks are a latency optimization, not a substitute for a periodic full-consistency pass.
- **Batch**: A polling/delta-sync sweep (e.g., every few minutes) is simpler to build correctly and is a natural fit for Claude's Batch API (50% cost discount, 24h SLA) for the LLM tier — appropriate for less time-sensitive categories (newsletters, e-commerce, social) while urgent-path categories (needs-reply, phishing, meeting cancellations) should stay on the low-latency real-time/interactive path.
- **Recommended hybrid**: webhook-triggered wake-up → immediate rule-tier classification (sub-second) for all messages → immediate LLM call (standard, non-batch pricing) only for messages that plausibly touch "needs reply," "phishing," or "prioritization tier" → everything else (clearly a newsletter/promo/e-commerce/social by rules) queued into a batch job for confirmation/backfill if you want LLM-verification of the rule-tier's output at lower cost.

### 5.3 Data/state needed

- Per-user: VIP list (manual + auto-derived), category-correction history (feedback loop), sender-reputation cache (domain → historical category, to avoid re-classifying every newsletter from the same sender via LLM), OAuth tokens (encrypted, rotated), watch/subscription renewal timestamps.
- Global/shared (not per-user): brand-domain watchlist for lookalike detection, common bulk-sender domain list (LinkedIn, common e-commerce carriers) to seed rule-tier confidence quickly for new users.

### 5.4 Security/privacy

- **Scope minimization**: request `gmail.modify`+`gmail.labels` (not full `mail.google.com`) and Graph `Mail.ReadWrite`+`MailboxSettings.ReadWrite` (not broader `Mail.ReadWrite.All`/application-level access unless truly needed) — every extra scope both widens breach blast-radius and increases OAuth consent-screen abandonment.
- Reading full email content is a high-sensitivity operation (personal/medical/financial/legal content plus auth codes) — minimize retention (process-and-discard where possible rather than storing full bodies), encrypt tokens and any stored content at rest, and write a clear, specific consent-screen justification per scope requested.
- Tokens: access tokens are short-lived (~1h) by design on both platforms; refresh tokens can be long-lived — store in a managed secrets store, not application DB rows, with rotation.

**Source:** [Gmail Add-ons/Apps Script architecture](https://msofficeaddin.com/blog/google-workspace/gmail/gmail-extensions-guide), [Outlook vs Gmail add-ins comparison](https://www.officeaddinsdevelopment.com/blog/outlook-add-ins-vs-gmail-add-ins-whats-the-difference), [middleware/API-layer pattern description](https://www.clawagora.com/en/blog/ai-agent-email-automation-gmail-outlook), [OAuth scope minimization best practices](https://www.obsidiansecurity.com/blog/oauth-scopes-permissions-security-best-practices), [OAuth consent best practices](https://auth0.com/blog/the-art-of-user-consent-management-oauth/), [token lifecycle best practices](https://www.unipile.com/oauth-email-api/)

---

## 6. Recommended Architecture (Synthesis)

```
                         ┌─────────────────────────────────────────┐
                         │  Ingestion Layer (per-platform adapter)  │
                         │  Gmail: watch()+PubSub, historyId sync   │
                         │  Outlook: /subscriptions webhook +       │
                         │           delta query backstop           │
                         └───────────────────┬───────────────────────┘
                                              │ normalized message envelope
                                              ▼
                         ┌─────────────────────────────────────────┐
                         │  Tier 1 — Deterministic rules (ms, $0)   │
                         │  • Sender domain / brand watchlist match │
                         │  • List-Unsubscribe / Precedence /       │
                         │    Auto-Submitted / List-Id headers      │
                         │  • SPF/DKIM/DMARC pass-fail              │
                         │  • text/calendar METHOD:CANCEL           │
                         │  • schema.org Order/ParcelDelivery JSON-LD│
                         │  • thread/conversation-state (last-      │
                         │    sender != user ⇒ candidate needs-reply)│
                         └───────────────────┬───────────────────────┘
                                   high-confidence ─┐   low-confidence/
                                   (majority of vol) │   ambiguous tail
                                                     ▼
                         ┌─────────────────────────────────────────┐
                         │  Tier 2 — Cheap LLM classifier (Haiku-   │
                         │  class), structured JSON output, few-    │
                         │  shot (~5 ex/label), multi-label over    │
                         │  the 11 categories + confidence          │
                         └───────────────────┬───────────────────────┘
                                   still-ambiguous / phishing-       
                                   adjacent / high-stakes            
                                                     ▼
                         ┌─────────────────────────────────────────┐
                         │  Tier 3 — Frontier LLM (Sonnet/Opus-     │
                         │  class), reasoning-heavy: phishing intent│
                         │  classification, BEC/urgency framing,    │
                         │  nuanced prioritization scoring          │
                         └───────────────────┬───────────────────────┘
                                              ▼
                         ┌─────────────────────────────────────────┐
                         │  Prioritization scorer (0–100):          │
                         │  VIP list + interaction frequency +      │
                         │  urgency language + deadline/calendar    │
                         │  proximity + needs-reply flag            │
                         └───────────────────┬───────────────────────┘
                                              ▼
                         ┌─────────────────────────────────────────┐
                         │  Platform write-back adapter             │
                         │  Gmail: labels.modify (add category      │
                         │         labels, don't fight native tabs) │
                         │  Outlook: message.categories +/or move   │
                         │           to folder + set importance     │
                         └───────────────────┬───────────────────────┘
                                              ▼
                         ┌─────────────────────────────────────────┐
                         │  Feedback loop: user corrections (moved/ │
                         │  relabeled msg) captured as labeled data,│
                         │  feeds few-shot example refresh + sender-│
                         │  reputation cache updates                │
                         └───────────────────────────────────────────┘
```

**Key design choices baked in above:**
- Rules resolve the majority of volume (newsletters, e-commerce, LinkedIn, social, meeting cancellations, sales/deals) at near-zero cost before any LLM call.
- LLM tiers are reserved for genuinely hard categories: needs-a-reply, prioritization nuance, and phishing intent — where research shows LLMs materially outperform pure heuristics.
- Native platform capabilities are *used*, not duplicated: Outlook's rule engine can handle the simplest sender-based rules directly; Focused Inbox and Gmail's tab categories are treated as one more input signal, not overridden or ignored.
- Batch API used for non-urgent bulk/backfill classification; standard interactive calls reserved for time-sensitive categories.

### Key trade-offs and open decisions for the team

1. **Category boundary ambiguity**: "Sales & deals" vs. generic "Newsletters" vs. Gmail's own Promotions tab, and "Social" vs. "LinkedIn" are genuinely fuzzy boundaries — the team should decide whether LinkedIn is *strictly* a sender-domain rule (simple, deterministic) or needs LLM disambiguation for edge cases (e.g., a LinkedIn digest that also contains a job posting — does it go to Jobs, LinkedIn, or both, given categories are multi-label?).
2. **Multi-label vs. single-label per message**: the taxonomy as specified (11 categories including cross-cutting ones like "Prioritization tier" and "Needs a reply") strongly implies **multi-label** classification (a message can be e-commerce AND needs-a-reply AND high-priority simultaneously) — confirm this is the intended model before building a single-label pipeline.
3. **Where phishing sits relative to the others**: should a flagged-phishing email be *excluded* from all other categorization (quarantined) or still receive its other labels for visibility? Native platform filters already block the most obvious cases before your pipeline sees them — decide whether your phishing layer is a hard block/quarantine action or a soft "flagged" label alongside normal routing.
4. **Real-time SLA for "needs a reply" and "meeting cancellation"**: these are the two categories where staleness has real user cost (missed deadline, showing up to a cancelled meeting) — worth explicitly deciding a max-latency target (e.g., <2 min) that shapes whether you can rely on webhook-triggered pushes alone or need tighter polling as backstop.
5. **Build-vs-buy for the rule engine**: Outlook's native message-rules API and Gmail's native filter API can absorb some of Tier 1 directly — decide whether to push simple rules into the platforms' own rule engines (less infra to run, but harder to centrally audit/version) vs. keep all rules in your own service (more control, more to build).
6. **LLM provider/model selection and cost ceiling**: given the Batch API discount and Haiku-class recommendation for classification, model the expected daily message volume per user against expected LLM spend before committing — the rules-first architecture is specifically designed to keep this bounded regardless of inbox volume growth.
7. **Feedback-loop mechanics**: decide whether corrections are captured passively (user moves a message to a different label/folder — inferred correction) or require an explicit UI action (more reliable signal, more friction) — passive inference is more scalable but noisier (a user moving a message for reasons unrelated to category correctness would pollute the training signal).

---

## Full Source List

- [Gmail labels API – Nylas](https://developer.nylas.com/docs/cookbook/email/gmail-labels-api/)
- [Configure push notifications in Gmail API – Google](https://developers.google.com/workspace/gmail/api/guides/push)
- [Gmail API Push Notifications – Unipile](https://www.unipile.com/gmail-api-push-notifications/)
- [People API – Google](https://developers.google.com/people/api/rest)
- [OAuth Scopes for Email, Explained – Nylas](https://cli.nylas.com/guides/oauth-scopes-for-email-explained)
- [Outlook mail API overview – Microsoft Learn](https://learn.microsoft.com/en-us/graph/outlook-mail-concept-overview)
- [List rules – Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/mailfolder-list-messagerules?view=graph-rest-1.0)
- [Focused Inbox resource – Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/resources/manage-focused-inbox?view=graph-rest-1.0)
- [Microsoft Graph throttling limits](https://learn.microsoft.com/en-us/graph/throttling-limits)
- [List-Unsubscribe Header guide – Litmus](https://www.litmus.com/blog/the-ultimate-guide-to-list-unsubscribe)
- [List-Unsubscribe Header – GMass](https://www.gmass.co/blog/list-unsubscribe-header/)
- [Precedence/Auto-Submitted headers explained](https://reviewmyemails.com/emailalmanac/esp-and-infrastructure/message-mechanics-mime-attachments-list-unsubscribe/precedence-bulk-auto-submitted-headers)
- [RFC 3834 summary – Mailer To Go](https://www.mailertogo.com/rfc/3834)
- [Abusing automatic calendar processing (ICS METHOD:CANCEL)](https://www.tarlogic.com/blog/abusing-calendar-processing/)
- [Order – Schema.org](https://schema.org/Order)
- [Schema Markup for Emails – Email on Acid](https://www.emailonacid.com/blog/article/email-development/schema-markup-gmail/)
- [Smarter multi-label predictions with adaptive few-shot prompting](https://medium.com/@alexandrdzhumurat/smarter-multi-label-predictions-with-adaptive-few-shot-prompting-2b3da7e08239)
- [Evaluating LLMs for Multi-label Text Classification](https://www.researchgate.net/publication/397610881_Evaluating_LLMs_for_Multi-label_Text_Classification)
- [LLM inference cost optimization – GMI Cloud](https://www.gmicloud.ai/en/blog/llm-inference-cost-optimization-caching-batching-routing)
- [Claude pricing 2026 – CloudZero](https://www.cloudzero.com/blog/claude-pricing/)
- [Claude cost optimization: Batch API + prompt caching](https://pecollective.com/tools/claude-pricing-guide/)
- [Detecting Emails Containing Requests for Action – ACL Anthology](https://aclanthology.org/N10-1142.pdf)
- [Detection of Question-Answer Pairs in Email Conversations – Columbia](http://www.cs.columbia.edu/nlp/papers/2004/shrestha_mckeown_04.pdf)
- [AI-powered email analysis – Email Meter](https://docs.enterprise.emailmeter.com/ai-features/overview)
- [Priority Email System – Mailbird](https://www.getmailbird.com/build-priority-email-system-process-inbox-faster/)
- [How to Automatically Prioritize Emails – DailyTaskProAI](https://dailytaskproai.com/blog/how-to-prioritize-emails-automatically)
- [Google Workspace: manage important/sensitive emails](https://support.google.com/a/users/answer/11349123?hl=en)
- [SPF, DKIM & DMARC Setup Guide 2025 – Mailfloss](https://mailfloss.com/spf-dkim-dmarc-email-authentication-setup-guide/)
- [Email Authentication Protocols 2025 – Email on Acid](https://www.emailonacid.com/blog/article/email-deliverability/email-authentication-protocols/)
- [Typosquatting: Detect Lookalike Domains – Breachsense](https://www.breachsense.com/typosquatting/)
- [How to detect domain lookalike attacks – Valimail](https://www.valimail.com/blog/how-to-detect-lookalike-domains/)
- [Safe Links overview – Defender for Office 365](https://learn.microsoft.com/en-us/defender-office-365/safe-links-about)
- [Anti-phishing policies in Microsoft 365](https://learn.microsoft.com/en-us/defender-office-365/anti-phishing-policies-about)
- [LLM-Powered Intent-Based Categorization of Phishing Emails (arXiv:2506.14337)](https://arxiv.org/abs/2506.14337)
- [SaneBox vs Superhuman – UseCarly](https://www.usecarly.com/blog/superhuman-vs-sanebox/)
- [Best AI Email Management Tools 2026 – Unboxd](https://unboxd.ai/blog/best-ai-email-tools.html)
- [EmailTree AI Classification](https://emailtree.ai/ai-email-classification/)
- [Missive: Using Gmail smart categories](https://missiveapp.com/docs/core-features/connected-accounts/email-accounts/gmail-google-workspace/using-gmail-smart-categories)
- [Talon – GitHub (Mailgun)](https://github.com/mailgun/talon/)
- [Apache SpamAssassin](https://spamassassin.apache.org/)
- [Rspamd](https://rspamd.com/)
- [Open Source Anti-Spam Tools 2026 comparison](https://portalzine.de/open-source-anti-spam-tools-in-comparison-for-an-ai-world/)
- [Email Parser by Zapier guide](https://zapier.com/blog/email-parser-guide/)
- [Gmail Add-ons developer guide – MSOfficeAddin](https://msofficeaddin.com/blog/google-workspace/gmail/gmail-extensions-guide)
- [Outlook vs Gmail Add-ins – iFour](https://www.officeaddinsdevelopment.com/blog/outlook-add-ins-vs-gmail-add-ins-whats-the-difference)
- [AI Agent Email Automation architecture – ClawAgora](https://www.clawagora.com/en/blog/ai-agent-email-automation-gmail-outlook)
- [OAuth Scopes security best practices – Obsidian Security](https://www.obsidiansecurity.com/blog/oauth-scopes-permissions-security-best-practices)
- [The Art of Consent Management in OAuth – Auth0](https://auth0.com/blog/the-art-of-user-consent-management-oauth/)
- [OAuth Email API token lifecycle – Unipile](https://www.unipile.com/oauth-email-api/)
- [AI in the Loop: feedback retraining – Medium](https://medium.com/@myakalarajkumar1998/ai-in-the-loop-building-a-feedback-retraining-system-that-learns-from-mistakes-13a5761bb042)

**Note on evidence quality overall**: Official platform documentation (Google Developers, Microsoft Learn) is treated as high-confidence. Peer-reviewed/arXiv papers on classification and phishing-intent detection are medium-high confidence but represent single studies, not consensus benchmarks specific to this exact 11-category taxonomy. Product/vendor blog posts (pricing, tool comparisons, scoring-formula specifics) are lower confidence and should be spot-checked against current official docs before being treated as implementation-ready specs, since several are SEO/marketing content rather than technical documentation.
