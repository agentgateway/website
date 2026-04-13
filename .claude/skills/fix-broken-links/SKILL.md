---
name: fix-broken-links
description: Review a Lychee link checker report from a GitHub issue and propose fixes for errors, warnings (broken anchors), and redirects in a Hugo docs repo. Use when the user asks to "fix broken links", "review the link report", "triage link checker issues", or points at a link checker issue (for example agentgateway/website#383).
version: 1.0.0
---

# Fix broken links skill

Use this skill when the user provides a Lychee link checker report (usually posted as a GitHub issue) and asks to triage or fix the findings in a Hugo-based documentation repository.

The report has three sections: **Errors**, **Warnings (broken anchors)**, and **Redirects**. Each bullet contains the link, followed by `Found on:` with one or more source HTML paths under `public/`.

---

## Input

The user will give you a link to a GitHub issue, or paste the issue body. Example: https://github.com/agentgateway/website/issues/383

If given a URL, fetch the issue body with:

```sh
gh issue view <N> --repo <owner>/<repo> --json body -q .body
```

---

## Mapping source paths to editable files

Source paths in the report look like `public/docs/kubernetes/latest/install/argocd/index.html`. These are built HTML files — you cannot edit them directly. Map them to source files:

1. **Thin content wrapper**: Under `content/` (the Hugo content directory). Often a `.md` file whose body is just `{{< reuse "..." >}}` or a similar include.
2. **Asset / reuse body**: If the content wrapper is a reuse or include, the real prose lives under a shared directory (in this repo, `assets/agw-docs/pages/...`). **Edit the shared file, not the thin wrapper.** Editing the shared file fixes all versions that reuse it.
3. **Snippet**: A smaller shared fragment (in this repo, under `assets/agw-docs/snippets/...`) if referenced through another reuse chain.

How to tell which category a page falls in:
- Read the content file at the mapped path.
- If the body is essentially one `{{< reuse "..." >}}` shortcode (or similar include), follow that reference to the shared file and edit there.
- If the body has real prose, edit the content file directly.

Example mapping:
- `public/docs/kubernetes/latest/install/argocd/index.html`
  → content wrapper: `content/docs/kubernetes/latest/install/argocd.md`
  → if wrapper is `{{< reuse "agw-docs/pages/install/argocd.md" >}}`, edit `assets/agw-docs/pages/install/argocd.md`

---

## Scope — what to skip

- **Reference docs**: Skip any source path under a `reference/` directory (for example `public/docs/kubernetes/*/reference/api/index.html`, `reference/helm/*`, `reference/cel/*`). These are typically generated from external code repos and shouldn't be hand-edited in the docs repo. Report them as "skipped — generated reference content" and move on.
- **Other generated content**: Apply the same rule for any other directory the repo treats as build output of external sources. Check the repo's README or CONTRIBUTING guide if unsure.

---

## Triage workflow

Work through the report top-down: Errors first, then Warnings, then Redirects. For each entry:

1. Skip if the source is under `reference/` or another generated directory (see above).
2. Identify the source file(s) to edit using the mapping above.
3. Apply the rules for that category below.
4. Record the finding in a summary you'll report to the user at the end.

**Do NOT open a PR or push commits.** Make local edits only. The user will review.

### Errors

Broken links (non-anchor, or anchors where the page itself is gone).

1. **Check for false positives first.** Fetch the URL (WebFetch) to see if it actually loads. If it does, note it as a false positive and suggest a likely reason:
   - **JS-rendered anchors** (common for kubernetes.io tabs, AWS console, Azure Learn, Google AI docs, and other modern docs sites). Lychee parses static HTML and looks for `id="..."`. Pages that build anchors with JavaScript at runtime have no matching IDs in the static HTML, so lychee reports them broken even though they work in browsers. There is no lychee config to fix this short of running JS. To verify: curl the page, grep for `id=` near the expected anchor name. If the page's static HTML has *no* IDs that match the expected pattern *and* the page loads in a browser to the right section, it's JS-rendered. **Important**: a missing static `id=` could also mean the anchor is genuinely broken (the section was renamed) — always confirm in a browser before calling it a false positive.
   - Lychee user-agent blocked or rate limiting.
   - URL-encoding Lychee mishandles (for example trailing `%29` from a stray `)` in markdown).
   - Link is inside a tab / collapsible / conditional-render that Lychee parses differently.
2. **Try to find the new location.** Read the source file and look at the text surrounding the link. If the link is clearly meant to point somewhere specific (for example, a markdown link like `[install guide](URL)`), check whether the target content moved. Browse the target site (WebFetch the parent directory listing or use a site search) to locate the current URL.
3. **Apply the fix** in the mapped source file (shared/asset file if the content wrapper is a reuse, otherwise the content file). If you cannot confidently determine the new URL, record it as "needs human review" and do not edit.

### Warnings — broken anchors

The page exists but the `#fragment` does not resolve.

1. Fetch the target page and check the current anchor IDs (search for `id="..."` in the HTML).
2. Map the old anchor to the current one — sections are often renamed (for example `#health-checks` → `#health-check-policies`).
3. If the anchor's content moved to a different page, update both the path and the fragment.
4. If the content was removed entirely, consider removing the link or changing it to a page-level link. Flag this for review.
5. For warnings on external sites (kubernetes.io, git.k8s.io, gateway-api.sigs.k8s.io, etc.) that look like false positives, verify in-browser — these often work but Lychee's fragment validator can be strict about URL-encoded anchors. Leave a note rather than silently excluding.

### Redirects

Lychee reports each as `original → final`.

1. **Skip auth/login redirects.** If `final` is a sign-in / SSO / login page, the original URL is fine — users will authenticate and reach the right place. Don't edit. Report it back though.
2. **Skip canonical short-form / always-redirecting URLs.** Some URLs are intentionally short forms that always redirect to the current target. Don't update these — instead, suggest adding them to `lychee.toml`'s exclude list so they stop appearing in future reports. Examples:
   - `github.com/<owner>/<repo>/releases/latest` → versioned tag (the `/latest` URL is intentional — it auto-tracks the newest release).
   - `discord.gg/<code>` → `discord.com/invite/<code>` (the short form is canonical).
   - `github.com/user-attachments/assets/<id>` → time-limited S3 signed URL (the short form is the only stable URL).
3. **Otherwise, update the source** to the `final` URL. Common cases are vendor doc restructures (Microsoft Learn, Google Cloud, Anthropic, AWS) and project rebrands or host moves.

---

## Making edits

- Edit **shared/asset files** when the content wrapper is a reuse or include. This fixes all versions at once.
- Edit **content files** only when the content is version-specific and not a reuse.
- If the same broken link appears in multiple source files that all trace back to the same shared file, edit the shared file once.
- Use the `Edit` tool with enough surrounding context to make the match unique.
- For repeated identical replacements across many files (typical for redirect fixes), batch with `sed -i ''` over a `find` of the relevant directories. Always quote URLs and escape `.` and `/` carefully. After a batch, grep to confirm the old pattern is gone.
- **Watch for trailing-slash variants.** A URL like `https://jwt.io/` appears in the report, but docs often also contain `https://jwt.io` (no slash) in other files. A sed pattern of `jwt\.io/` won't match the no-slash form. Either run two sed passes (with and without the trailing slash), or use a pattern that tolerates both (for example, matching inside markdown link parentheses: `(https://jwt\.io)` and `(https://jwt\.io/)`). After the batch, grep for the base hostname (without slash) to catch any stragglers.

### Conditional content for cross-variant link breakage

If a link works for one product variant (for example, the Kubernetes docs) but the target doesn't exist in another variant (for example, the standalone docs) because the content is organized differently, wrap the offending sentence in a build-condition shortcode rather than removing it. Check the repo for an existing conditional shortcode (often called `conditional-text`, `if-product`, or similar) and use it like:

```
{{< conditional-text include-if="kubernetes" >}}For more information, see [...](...).{{< /conditional-text >}}
```

This keeps the link visible where it works and silently drops it where it doesn't.

### Updating lychee config for false positives

When you confirm a class of false positives, update the shared `lychee.toml` exclude list so they don't reappear. Group the patterns with a comment explaining *why* (JS-rendered anchors, intentional short-form URLs, etc.) so future maintainers don't strip them as noise.

---

## Reporting back

After processing the report, give the user a structured summary. Group findings by outcome:

```
## False positives
- <link> — <why it's actually working> (added to lychee.toml exclude / suggest adding to lychee.toml exclude)

## Skipped — kept as redirect-as-intended
- <link> — <why the redirect is intentional> (added to lychee.toml exclude / suggest adding)

## Needs human review
- <link> in <file> — <why: couldn't determine new URL / content removed / cross-variant content gap / shortcode bug / etc.>

## Skipped — generated reference content
- <N> links under reference/ directories
```

Keep the summary concise. Do not include long lists of identical reference/ skips. Fixed links do not need to be reported individually unless the user specifically asks. If you spot a root-cause bug (for example a shortcode that produces broken URLs for certain inputs), call it out in "Needs human review" with a pointer to the file and the suggested fix.

---

## Don't

- Don't open a PR or push. Local edits only.
- Don't edit files under `public/` — those are build output.
- Don't edit generated reference pages even if you think you know the fix.
- Don't guess new URLs. If you can't verify, flag for review.
- Don't edit the thin content wrapper when the body is a reuse — edit the shared file.
