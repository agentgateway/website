---
title: Page title, title case, starts with an imperative verb or a single noun, no ending punctuation
weight: 10
description: 1-2 sentence short description of the page, optimized for search engines.
---

1-2 sentence short description of the page, optimized for search engines.

> [!NOTE]
> This page is for example only, referred to in the [STYLE_GUIDE.md](STYLE_GUIDE.md) file.

## About

2-3 paragraph introduction explaining what, why, and common use cases. Might include a diagram or link out to a concept page for more information.

## Before you begin

Any prereq steps, often a `reuse` shortcode to include a snippet from the `agw-docs/snippets` directory.

## [Task 1, starts with a verb or a single noun, no ending punctuation]

1-2 sentence description of the task.

1. Ordered list of steps to complete the task.
2. Each step should be a single sentence or short paragraph. Can link to other pages if needed.
3. Start with an imperative verb.
4. Most steps include a code example, command, configuration block, or similar example.

   ```sh
   curl -sL https://agentgateway.dev/install | bash
   ```

   Example output:

   ```
   % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
   100  8878  100  8878    0     0  68998      0 --:--:-- --:--:-- --:--:-- 69359

   Downloading https://github.com/agentgateway/agentgateway/releases/download/v0.4.16/agentgateway-darwin-arm64
   Verifying checksum... Done.
   Preparing to install agentgateway into /usr/local/bin
   Password:
   agentgateway installed into /usr/local/bin/agentgateway
   ```

### [Step 1: Start with a verb or a single noun, no ending punctuation]

For more complex steps, you can split the steps into numbered substeps.

## Troubleshooting

Optional section to provide troubleshooting information.

### Common Issue 1

**What's happening:**

Describe the user-facing behavior. When possible, include logs or error messages that match what they might search for.

**Why it's happening:** 

Possible reasons why the issue happens.

**How to fix it:**

Steps or options for how to fix the issue.

## What's next

Optional section if the next page in the doc set is not relevant to the current page. Otherwise, the Hugo theme automatically adds previous and next page links at the bottom of the page.