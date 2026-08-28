---
title: Page title, title case, starts with an imperative verb or a single noun, no ending punctuation
weight: 10
description: 1-2 sentence short description of the page, optimized for search engines.
---

1-2 sentence short description of the page, optimized for search engines.

> [!NOTE]
> This page is for example only, referred to in the [STYLE_GUIDE.md](STYLE_GUIDE.md) file.
>
> Notes use GitHub-style alerts like this one, not the `callout` shortcode. Every line of the body needs the `>` prefix, including blank lines.

## About

2-3 paragraph introduction explaining what, why, and common use cases. Might include a diagram or link out to a concept page for more information.

## Before you begin

Any prereq steps, often a `reuse` shortcode to include a snippet from the `agw-docs/snippets` directory.

## [Task 1, starts with a verb or a single noun, no ending punctuation]

2-3 sentences: what this section does, why the reader does it, and how it fits the rest of the guide. Not a restatement of the heading. Anything the reader must know before running *any* step in this section goes here, above step 1 — not in a note at the end.

1. Ordered list of steps to complete the task. Start each one with an imperative verb.
2. Each step carries its own context. Say what the step does and why in the same list item, so the reader knows before running it rather than after.
3. Most steps include a code example, command, configuration block, or similar example.

   ```sh
   curl -sL https://agentgateway.dev/install | bash
   ```

   Example output goes immediately under the command that produces it, truncated if it is long:

   ```
   Downloading https://github.com/agentgateway/agentgateway/releases/download/v0.4.16/agentgateway-darwin-arm64
   Verifying checksum... Done.
   Preparing to install agentgateway into /usr/local/bin
   agentgateway installed into /usr/local/bin/agentgateway
   ```

4. A step that applies configuration shows the complete block, then a table describing the fields the reader has to decide about.

   ```yaml
   binds:
   - port: 3000
     listeners:
     - routes:
       - policies:
           cors:
             allowOrigins: ["https://example.com"]
             allowCredentials: true
   ```

   | Field | Description |
   | ----- | ----------- |
   | `binds[].port` | Port the gateway listens on. |
   | `policies.cors.allowOrigins` | Origins allowed to make cross-origin requests. Omit to match any origin. |
   | `policies.cors.allowCredentials` | Whether the browser may send credentials. Cannot be `true` while `allowOrigins` is `["*"]`; the gateway rejects that combination at startup. |

   Every field name in the table is findable in the example above it, and each gotcha lives in the row of the field it constrains — not in a note after the list. Nesting is what the reader cannot guess, so name the full path.

### [Step 1: Start with a verb or a single noun, no ending punctuation]

For more complex steps, you can split the steps into numbered substeps.

## Troubleshooting

Optional section to provide troubleshooting information. Provide troubleshooting information only if the guide does not already cover an optimal path that avoids the potential for the issue, or if there are many users hitting this issue.

### Common Issue 1

**What's happening:**

Describe the user-facing behavior. When possible, include logs or error messages that match what they might search for.

**Why it's happening:** 

Possible reasons why the issue happens.

**How to fix it:**

Steps or options for how to fix the issue.

## What's next

Optional section if the next page in the doc set is not relevant to the current page. Otherwise, the Hugo theme automatically adds previous and next page links at the bottom of the page.

The same applies to an `_index.md`: the theme generates a card grid of the section's children, so do not hand-write one. See [Index pages](STYLE_GUIDE.md#index-pages).