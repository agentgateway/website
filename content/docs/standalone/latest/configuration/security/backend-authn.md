---
title: Backend authentication
weight: 10
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

When connecting to a backend, an authentication token can be attached to each request using the backend authentication policy.

To attach a static key as an `Authorization` value, use `key`:

```yaml
backendAuth:
  key: $MY_API_KEY
```

A file path can also be used:

```yaml
backendAuth:
  key:
    file: /path/to/my/key
```

When using any form of incoming authentication (such as [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}), or [basic auth]({{< link-hextra path="/configuration/security/basic-authn/" >}})), the original credential is removed from the request by default before forwarding to the backend.
To pass the original credential through to the backend unchanged, use the `passthrough` method:

```yaml
backendAuth:
  passthrough: {}
```

Google [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) can also be used, which can be useful when connecting to GCP services:

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