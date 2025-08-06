---
title: Vertex AI
weight: 20
description: Configuration and setup for Google Cloud Vertex AI provider
---

## Configuration

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
```

Connecting to Vertex requires authentication using [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials).
Ensure you follow one of the three methods (`GOOGLE_APPLICATION_CREDENTIALS`, `application_default_credentials.json`, or metadata server) listed above.
