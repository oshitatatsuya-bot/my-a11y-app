# A11yFix User Guide

**Product:** https://www.geta11yfix.com  
**Support:** support@geta11yfix.com  

A11yFix helps teams **find WCAG issues on public pages, generate AI code fixes, open GitHub PRs, show progress (badge / draft ACR), and monitor score regressions**.  
It is **not** an overlay widget. It focuses on code and audit-friendly artifacts.

---

## 1. What you can do

| Feature | Purpose |
|---------|---------|
| **Site scan / Single page** | Discover same-host pages via sitemap, or scan one URL |
| **Fix with AI** | Suggested HTML fixes; axe-core re-check when possible |
| **GitHub PR** | Open a pull request (token used once, not stored) |
| **History** | Reopen past scans and re-run fixes without a new scan |
| **Badge** | Embeddable score image for a host |
| **Draft ACR** | Automated conformance **draft** (not a signed VPAT) |
| **Monitoring** | Periodic re-check; email when the score drops |

---

## 2. Sign in

1. Open https://www.geta11yfix.com  
2. **Start free scan** or **Sign in**  
3. Enter your email and use the magic link (no password)  
4. Go to **/scan**

---

## 3. Plans & quotas

Quotas reset on the **UTC calendar month**.  
**Each scanned page uses one scan credit.**

| Plan | Sites / mo | Page scans / mo | AI fixes / mo | Site scan |
|------|------------|-----------------|---------------|-----------|
| **Free** | 3 | 15 | 15 | Up to 5 discovered; **2 inline**, rest queued |
| **Pro** ($29/mo) | 3 | 1,000 | 1,000 | Up to 25 discovered; **3 inline** |
| **Agency** ($99) | Waitlist | — | — | Onboarding required |

Notes:

- `example.com`, `example.org`, `example.net` (and `www.` variants) **do not consume a site slot**  
- Upgrade via **Upgrade to Pro** (Stripe)  
- Agency is waitlist-only for now  

---

## 4. Running a scan

### Site scan (recommended)

1. Select **Site scan (sitemap)**  
2. Paste a public URL  
3. Click **Scan site**  
4. We discover same-host pages, scan a few immediately, and queue the rest  

### Single page

1. Select **Single page**  
2. Scan one URL  

### Reading results

- **Score** (site mode): **worst successful page**, not an average  
- Page table: **Saved** or an error reason  
- Banner: draft ACR ≠ VPAT; badge ≠ legal conformance claim  

### If something fails

| Symptom | What to try |
|---------|-------------|
| **BOT_CHECK** | Staging URL, or `https://example.com` |
| **HTTP 504 / timeout** | Retry once, or use **Single page** |
| **SITE_LIMIT** | Reuse hosts already scanned this month, try example.com, or upgrade |
| **QUOTA** | Wait for next month or upgrade |

---

## 5. AI fixes & GitHub PRs

1. Click **Fix with AI** on a violation node  
2. Review status:
   - **Verified / axe-clean** — sandbox shows 0 remaining hits for that rule  
   - **Not verified** — review before merge  
   - **Not checked** — needs full-page context  
3. **Open GitHub PR** with owner, repo, file path, and a fine-grained PAT (Contents + Pull requests write). Token is **not stored**.

AI output is a suggestion. Always human-review before production.

---

## 6. History

Use **History** to reopen scans and re-run fixes without spending another scan credit on a fresh crawl.

---

## 7. Draft ACR (not a VPAT)

Click **Open draft ACR (not a VPAT)**. Use **Print / Save as PDF** if needed.

This is an **automated axe-based draft** for internal sharing. It is **not**:

- a signed VPAT® / formal ACR  
- legal advice  
- sufficient alone for procurement sign-off  

Manual testing (keyboard, screen readers, etc.) remains required.

---

## 8. Embeddable badge

Copy the HTML snippet from results.

- It shows a **score**, not a legal “WCAG certified” claim  
- Treat the `token` in the URL as a secret  

---

## 9. Score monitoring

1. **Enable score monitoring**  
2. Confirm alert email → **Save monitor**  
3. Slack is optional; only `https://hooks.slack.com/...` URLs are accepted  

We re-check due hosts on a daily scheduler; **email when the score drops** vs the last check. Each check uses one scan credit.

---

## 10. Billing (Pro)

- Upgrade via Stripe Checkout  
- Cancel / update card in the Stripe Customer Portal  
- See **/terms** for refunds and legal terms; **/privacy** for data practices; **/tokutei** for Japan disclosure  

---

## 11. Support

Email **support@geta11yfix.com** with the URL you scanned and a screenshot if possible.  
We aim to reply within one business day.

---

## 12. FAQ

**Does this prevent ADA lawsuits?**  
No guarantee. A11yFix is tooling, not legal advice or a compliance warranty.

**Can you crawl my entire enterprise site in one request?**  
We use sitemaps and queue overflow pages. Huge properties are not fully guaranteed in one interactive run.

**Why did bot protection stop the scan?**  
We refuse to score challenge/interstitial HTML. Use staging or a publicly cacheable page.

---

*Last updated: 2026-09-14*
