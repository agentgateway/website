---
title: Passthrough
weight: 50
description: Forward requests to the upstream provider without transformation.
test: skip
---

The `passthrough` route type forwards requests to the upstream LLM provider as-is, without translating between API formats.

## About

By default, agentgateway interprets known endpoints (such as `/v1/chat/completions`, `/v1/messages`, and `/v1/responses`) and translates between provider API formats. The `passthrough` route type instead forwards the request to the backend provider unmodified.

Use passthrough for endpoints that agentgateway does not natively translate, or when you want the provider to receive the request exactly as the client sent it. Because the request is not interpreted as LLM traffic, LLM policies such as prompt guards, prompt enrichment, and request-body rate limiting do not apply.

In the simplified `llm` configuration, any path that does not match a known endpoint falls back to the `passthrough` route type automatically.

## Route type configuration

To pass all traffic through without interpretation, set `passthrough: opaque` on the model in the simplified `llm` configuration.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    passthrough: opaque
```

To configure passthrough as a fallback for unmatched paths in the `binds/listeners/routes` format, map the `*` wildcard path to the `passthrough` route type.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 4000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI: {}
      policies:
        ai:
          routes:
            "/v1/chat/completions": "completions"
            "*": "passthrough"
        backendAuth:
          key: "$OPENAI_API_KEY"
```

## Extract telemetry from passthrough traffic

To pass requests through while still extracting token usage and rate-limit data when possible, set `passthrough: detect`. This inspects the request and response to record telemetry, but does not apply guardrails.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    passthrough: detect
```

For more information about LLM metrics and observability, see [Observe traffic]({{< link-hextra path="/llm/observability/" >}}).
