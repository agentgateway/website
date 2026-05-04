---
title: CEL expressions
weight: 10
icon: code
description: Use CEL (Common Expression Language) to write request-aware policies, transformations, and observability rules.
test: skip
---

Agentgateway uses the {{< gloss "CEL (Common Expression Language)" >}}CEL{{< /gloss >}} expression language throughout the project to enable flexibility. CEL allows writing simple expressions based on the request context that evaluate to some result.

This section covers everything you need to write and debug CEL expressions in agentgateway: the in-product playground, how to embed expressions in YAML, common example patterns, and the variables that are exposed at each policy phase.
