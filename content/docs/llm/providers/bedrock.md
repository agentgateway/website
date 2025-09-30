---
title: Amazon Bedrock
weight: 40
description: Configuration and setup for Amazon Bedrock provider
---

Configure Amazon Bedrock as an LLM provider in agentgateway.

## Authentication

Before you can use Bedrock as an LLM provider, you must authenticate by using the standard [AWS authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html).

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}}

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: bedrock
          provider:
            bedrock:
              region: us-west-2
              # Optional; overrides the model in requests
              model: amazon.titan-text-express-v1
          routes:
            /model/*/converse: completions
            /model/*/converse-stream: completions
            "*": passthrough
```

{{< reuse "docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `bedrock.region` | The AWS region. |
| `bedrock.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `ai.routes` | To support multiple LLM endpoints, you can set the `routes` field. The keys are URL suffix matches, like `/model/*/converse`. The wildcard character `*` can be used to match anything. If no route is set, the route defaults to the `completions` endpoint. |
