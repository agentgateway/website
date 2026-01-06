---
title: Mirroring
weight: 10
---

Request mirroring allows sending a copy of each request to an alterative backend.
These request will not be retried if they fail.

```yaml
requestMirror:
  backend:
    host: localhost:8080
  # Mirror 50% of request
  percentage: 0.5
```

**[Supported attachment points](/docs/configuration/policies/):** Route and Backend.