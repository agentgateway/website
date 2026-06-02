---
title: CEL expressions
weight: 15
description: Learn how agentgateway uses CEL expressions to write flexible policies.
test: skip
---

Agentgateway uses the {{< gloss "CEL (Common Expression Language)" >}}CEL (Common Expression Language){{< /gloss >}} throughout the project to enable flexibility.
CEL allows writing simple expressions based on the request context that evaluate to some result.

This section covers everything you need to write CEL expressions in agentgateway: how to embed expressions in YAML, common example patterns, and the variables and functions exposed at each policy phase.
