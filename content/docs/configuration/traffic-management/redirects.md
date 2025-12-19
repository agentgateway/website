---
title: Redirects
weight: 11
---

Request redirects allow returning a direct response redirecting users to another location.

For example, the following configuration will return a `307 Temporary Redirect` response with the header `location: https://example.com/new-path`:

```yaml
requestRedirect:
  scheme: https
  authority:
    full: example.com
  path:
    full: /new-path
  status: 307
```

**[Supported attachment points](/docs/configuration/policies/):** Route and Backend.