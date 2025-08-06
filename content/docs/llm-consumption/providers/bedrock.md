---
title: Amazon Bedrock
weight: 40
description: Configuration and setup for Amazon Bedrock provider
---

## Configuration

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
```

Connecting to Bedrock requires authentication using the standard AWS [authentication sources](https://docs.aws.amazon.com/sdkref/latest/guide/creds-config-files.html).
