---
title: Backend authentication
weight: 10
---

When connecting to a backend, an authentication token can be attached to each request using the backend authentication policy.

**[Supported attachment points](/docs/configuration/policies/):** Backend.

To attach a static key as an `Authorization` value, use `key`:

```yaml
backendAuth:
  key: $MY_API_KEY
```

A filepath can also be used:

```yaml
backendAuth:
  key:
    file: /path/to/my/key
```

When using [JWT authentication](#jwt-authentication), the original token is removed by default.
To add it back, the `passthrough` method can be used:

```yaml
backendAuth:
  passthrough: {}
```

Google [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials) can also be used, which can be useful when connecting to GCP services:

```yaml
backendAuth:
  gcp: {}
```

AWS authentication can be used to sign requests to AWS services:

```yaml
backendAuth:
  aws:
    # Specify access key and session token
    # Alternatively, leaving this empty will use the standard AWS credential lookup (https://docs.aws.amazon.com/sdkref/latest/guide/access.html) based on the environment
    accessKeyId: "$AWS_ACCESS_KEY_ID"
    secretAccessKey: "$AWS_SECRET_ACCESS_KEY"
    sessionToken: "$AWS_SESSION_TOKEN"
    region: us-west-2
```