---
title: Vertex AI
weight: 20
description: Configuration and setup for Google Cloud Vertex AI provider
---

Configure Google Cloud Vertex AI as an LLM provider in agentgateway.

## Authentication

Before you can use Vertex AI as an LLM provider, you must authenticate by using Google Cloud's [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials). Choose from one of the three methods:

- `GOOGLE_APPLICATION_CREDENTIALS`
- `application_default_credentials.json`
- metadata server

## Configuration

{{< reuse "docs/snippets/review-configuration.md" >}}

```yaml
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: vertex
          provider:
            vertex:
              projectId: my-project-id
               # Optional: defaults to 'global'
              region: us-west2
              # Optional; overrides the model in requests
              model: google/gemini-2.5-flash-lite-preview-06-17
          routes:
            /v1beta1/projects/*/locations/*/endpoints/openapi/chat/completions: completions
            "*": passthrough
```

{{< reuse "docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `vertex.projectId` | The Google Cloud project ID. |
| `vertex.region` | The Google Cloud region. Defaults to `global`. |
| `vertex.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
| `ai.routes` | To support multiple LLM endpoints, you can set the `routes` field. The keys are URL suffix matches, like `/v1beta1/projects/*/locations/*/endpoints/openapi/chat/completions`. The wildcard character `*` can be used to match anything. If no route is set, the route defaults to the `completions` endpoint. |
