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

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
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
```

{{< reuse "agw-docs/snippets/review-configuration.md" >}}

| Setting | Description |
|---------|-------------|
| `ai.name` | The name of the LLM provider for this AI backend. |
| `vertex.projectId` | The Google Cloud project ID. |
| `vertex.region` | The Google Cloud region. Defaults to `global`. |
| `vertex.model` | Optionally set the model to use for requests. If set, any models in the request are overwritten. If not set, the request must include the model to use. |
