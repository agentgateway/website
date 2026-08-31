---
title: Trace requests with agctl
weight: 16
description: Capture a per-request trace as a standalone agentgateway instance handles the request.
test:
  trace-validate:
  - file: ${versionRoot}/documentation/operations/trace-requests.md
    path: trace-validate
---

> [!WARNING]
> {{< reuse "agw-docs/snippets/feature-experimental.md">}}

{{< reuse "agw-docs/pages/operations/trace-requests-standalone.md" >}}

## Redact sensitive headers {#sensitive-headers}

A trace shows the headers of the request as agentgateway processes it, which can put a credential in your terminal, your scrollback, and any log that captures the output. Agentgateway always redacts the `Authorization` and `Proxy-Authorization` headers. To redact more, list them in `config.sensitiveHeaders`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  sensitiveHeaders:
  - x-api-key
  - cookie
  - x-tenant-secret
```

Agentgateway marks the listed headers when the request arrives, and marks them again after request and backend CEL transformations run. A header that a transformation creates is therefore redacted too, not only one that the client sent.

Redaction changes the trace and debug output only. Agentgateway still forwards the real header value to the backend, and the value is still readable from a CEL expression, so a policy or a custom log field that reads the header keeps working.

> [!NOTE]
> The field is in the `config` section, so agentgateway reads it at startup only. Restart agentgateway after you change it. Agentgateway validates each entry as an HTTP header name and fails to start if one is not valid, rather than ignoring it.

