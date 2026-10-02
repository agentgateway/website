---
title: Version 1.5.x
weight: 460
description: Use agentgateway in a Kubernetes environment. 
test: skip
# PDF export. This one page opting into `book` is the whole opt-in: the format
# stitches this page plus its entire .Pages subtree into one print document, so
# the PDF is scoped to this version tree by where the opt-in lives. The
# standalone tree opts in separately and publishes its own manual; the frozen
# version directories deliberately do not, so only /latest/ offers a download.
#
# LIST THE WHOLE SET, not just html and book. Hugo's `outputs` REPLACES a page's
# defaults rather than adding to them, so `["html", "book"]` would silently drop
# this page's .md, RSS and llms.txt. Nothing fails and only this page is
# affected, which is exactly why it would survive review. These four are
# `outputs.section` from hugo.yaml, copied, plus `book`.
#
# The book is not built by an ordinary build: docs-theme-extras gates it behind
# `HUGO_PARAMS_BUILDBOOK=true`, which only the PDF workflow in solo-io/docs sets.
outputs: ["html", "rss", "markdown", "llms", "book"]
---

Welcome to the documentation for using agentgateway on Kubernetes!

<br />

{{< reuse "agw-docs/pages/landing.md" >}}
