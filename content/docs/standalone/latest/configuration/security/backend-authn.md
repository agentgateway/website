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

When using [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), the original token is removed by default.
To add it back, the `passthrough` method can be used:

```yaml
backendAuth:
  passthrough: {}
```

Google Cloud Platform authentication can be used to authenticate with GCP services in multiple ways:

**Ambient Credentials (Application Default Credentials)**

The simplest approach uses Google [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials):

```yaml
backendAuth:
  gcp: {}
```

This method relies on ambient credentials from your environment (e.g., service account key, metadata service). No explicit credential configuration is needed.

**Explicit Credentials**

You can also provide explicit GCP credentials for either access token or ID token authentication.

For **access token** authentication with inline credentials (supported types: `authorized_user`, `service_account`, `impersonated_service_account`, `external_account`):

```yaml
backendAuth:
  gcp:
    auth:
      accessToken:
        credential: |
          {
            "type": "service_account",
            "project_id": "my-project",
            "private_key_id": "key-id",
            "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
            "client_email": "sa@my-project.iam.gserviceaccount.com",
            "client_id": "123456789",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
          }
```

Or reference a credential file:

```yaml
backendAuth:
  gcp:
    auth:
      accessToken:
        credential:
          file: /path/to/gcp-credentials.json
```

For **ID token** authentication with inline credentials (supported types: `authorized_user`, `service_account`, `impersonated_service_account`):

```yaml
backendAuth:
  gcp:
    auth:
      idToken:
        credential: |
          {
            "type": "service_account",
            "project_id": "my-project",
            "private_key_id": "key-id",
            "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
            "client_email": "sa@my-project.iam.gserviceaccount.com",
            "client_id": "123456789",
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token"
          }
        audience: "https://example.com"
```

Or reference a credential file:

```yaml
backendAuth:
  gcp:
    auth:
      idToken:
        credential:
          file: /path/to/gcp-credentials.json
        audience: "https://example.com"
```

**Credential Types**

When providing explicit credentials:
- **Access Token** supports: `authorized_user`, `service_account`, `impersonated_service_account`, `external_account`
- **ID Token** supports: `authorized_user`, `service_account`, `impersonated_service_account` (external_account is not supported for ID tokens)

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