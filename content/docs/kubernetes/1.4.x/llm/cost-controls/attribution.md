---
title: Invoice-grade attribution
weight: 15
description: Carry a validated caller identity into AWS billing records, so LLM spend is attributed per team, app, user, or any chosen attribution value on the provider's own bill.
# Not covered by a doc test. Every step needs a live AWS or Google Cloud account:
# the assumeRole policy requires an IAM role that permits sts:AssumeRole and
# sts:TagSession, cost allocation tags take up to 24 hours to become activatable,
# and the Verify steps read CloudTrail, Cost Explorer, Bedrock model invocation
# logs, and the GCP billing export. The equivalent standalone page validates the
# same field shapes with agentgateway --validate-only, which needs no credentials.
test: skip
---

{{< reuse "agw-docs/pages/agentgateway/llm/cost-controls/attribution.md" >}}
