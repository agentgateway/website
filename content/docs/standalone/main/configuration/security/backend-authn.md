---
title: Backend authentication
weight: 10
description: Attach authentication tokens to outgoing backend requests.
test:
  backend-authn:
  - file: content/docs/standalone/main/configuration/security/backend-authn.md
    path: backend-authn
---

Attaches to: {{< badge content="Backend" path="/configuration/backends/" >}}

{{< doc-test paths="backend-authn" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
export MY_API_KEY="${MY_API_KEY:-dummy}"
{{< /doc-test >}}

When connecting to a backend, an authentication token can be attached to each request using the backend authentication policy.

To attach a static key as an `Authorization` value, use `key`. The following example shows a complete configuration that attaches the policy to a backend.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
        policies:
          backendAuth:
            key:
              value: $MY_API_KEY
```

{{< doc-test paths="backend-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The static-key backendAuth example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The other backendAuth snippets on this page (file path, location,
#     passthrough, gcp, aws) are field-reference fragments with no `binds:`,
#     so they are not standalone configs and are not tested here.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - host: localhost:8080
        policies:
          backendAuth:
            key:
              value: $MY_API_KEY
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

The remaining examples on this page show only the `backendAuth` policy. Attach each one to a backend under `backends[].policies`, as shown in the complete example above.

A file path can also be used:

```yaml
backendAuth:
  key:
    value:
      file: /path/to/my/key
```

By default, the proxy retrieves the key from the `Authorization` header value. To use a different header name, use the `location` field as shown in the following example:

```yaml
backendAuth:
  key:
    value: $MY_API_KEY
    location:
      # Send as a request header (default)
      header:
        name: authorization
        prefix: "Bearer "
```

```yaml
backendAuth:
  key:
    value: $MY_API_KEY
    location:
      # Send as a query parameter
      queryParameter:
        name: api_key
```

```yaml
backendAuth:
  key:
    value: $MY_API_KEY
    location:
      # Send as a cookie
      cookie:
        name: api_key
```

When using any form of incoming authentication, such as [JWT]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [API key]({{< link-hextra path="/configuration/security/apikey-authn/" >}}), or [basic auth]({{< link-hextra path="/configuration/security/basic-authn/" >}}), the original credential is removed from the request by default before forwarding to the backend.
To pass the original credential through to the backend, use the `passthrough` method:

```yaml
backendAuth:
  passthrough: {}
```

The `passthrough` method also accepts a `location` field to specify where to read the credential from:

```yaml
backendAuth:
  passthrough:
    location:
      header:
        name: authorization
        prefix: "Bearer "
```

Google [Application Default Credentials](https://docs.cloud.google.com/docs/authentication/application-default-credentials) can also be used, which can be useful when connecting to GCP services:

```yaml
backendAuth:
  gcp: {}
```

To request an access token (for most GCP services) or an ID token (for Cloud Run), set the `type` field:

```yaml
backendAuth:
  gcp:
    type: AccessToken
```

```yaml
backendAuth:
  gcp:
    type: IdToken
    audience: "https://my-cloudrun-service-xyz.run.app"
```

Credentials are sourced from the environment automatically (for example, via the `GOOGLE_APPLICATION_CREDENTIALS` environment variable or a metadata server).

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
