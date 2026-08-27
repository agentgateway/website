---
title: Invoice-grade attribution
weight: 15
description: Carry a validated caller identity into AWS billing records, so LLM spend is attributed per team, app, user, or any chosen attribution value on the provider's own bill.
# The shared asset carries doc-test blocks for the 1.5-only finalTransformation
# examples. Those blocks are version-gated out of this page, but the test
# extractor does not evaluate version gates, so a scenario declared here would
# validate 1.5-only config against the 1.4 binary and fail. The examples that
# apply to this version are covered by the same scenario on the main page.
test: skip
---

{{< reuse "agw-docs/standalone/attribution.md" >}}
