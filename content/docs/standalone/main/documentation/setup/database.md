---
title: Database
weight: 25
description: Set up the SQLite or PostgreSQL database that the Analytics page, the Logs page, hybrid storage, and API key budgets need.
test:
  standalone-database:
  - path: standalone-database
---

{{< reuse "agw-docs/standalone/setup/database.md" >}}

## Verify database logging with agctl {#agctl}

After sending the LLM request in [Verify that agentgateway records requests](#verify), use the CLI to confirm that it was stored. [Install and connect agctl]({{< link-hextra path="/documentation/operations/config-resources/#connect" >}}) first, and keep the admin port-forward running for a Helm installation.

```sh
agctl standalone logs --limit 10
agctl standalone analytics --since 1h
```

The log table includes the completed request, and analytics includes its token usage and cost when available. An empty result can mean that no LLM request has been stored yet; database writes are asynchronous. A database-not-configured error means that the gateway needs a database connection and restart, as described above. See [View LLM request logs]({{< link-hextra path="/documentation/observability/access-logs/view/#cli" >}}) for filters and request details.
