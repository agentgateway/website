---
title: Retries
weight: 10
---

When a backend request fails, agentgateway can be configured to *retry* the request.
When a retry is attempted, a different backend will be preferred (if possible).

```yaml
retry:
  # total number of attempts allowed.
  # Note: 1 attempt implies no retries; the initial attempt is included in the content.
  attempts: 3
  # Optional; if set, a delay between each additional attempt
  backoff: 500ms
  # A list of HTTP response codes to consider retry-able.
  # In addition, retries are always permitted if the request to a backend was never started.
  codes: [429, 500, 503]
```

When a request has retries enabled and an HTTP body, the request body will be buffered.
If the total body size exceeds a threshold size, retries will be disabled.

**[Supported attachment points](/docs/configuration/policies/):** Route.