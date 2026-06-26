---
title: API Key authentication
weight: 17
description: Authenticate requests using API keys with configurable validation modes.
test:
  apikey-authn:
  - file: content/docs/standalone/main/configuration/security/apikey-authn.md
    path: apikey-authn
---

Attaches to: {{< badge content="Listener" path="/configuration/listeners/">}} {{< badge content="Route" path="/configuration/routes/">}}

{{< doc-test paths="apikey-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway.md" >}}
{{< /doc-test >}}

{{< gloss "API Key" >}}API key{{< /gloss >}} {{< gloss "Authentication (AuthN)" >}}authentication{{< /gloss >}} enables authenticating requests based on a user-provided API key.

> [!TIP]
> This policy is about authenticating incoming requests. For attaching API keys to outgoing requests, see [Backend Authentication](../backend-authn).

API Key authentication involves configuring a list of valid API keys, with associated metadata about the key (optional).

Additionally, authentication can run in three different modes:
* **Strict**: A valid API key must be present.
* **Optional** (default): If an API key exists, validate it.  
  *Warning*: This allows requests without an API key!
* **Permissive**: Requests are never rejected. This setting is useful for usage of claims in later steps such as authorization or logging.  
  *Warning*: This allows requests without an API key!

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      apiKey:
        mode: strict
        keys:
        - key: sk-testkey-1
          metadata:
            user: test
            role: admin
    routes:
    - backends:
      - host: localhost:8080
```

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The apiKey listener-level authentication example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a request with the given key is actually authenticated at runtime —
#     requires a backend the page omits to forward to.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      apiKey:
        mode: strict
        keys:
        - key: sk-testkey-1
          metadata:
            user: test
            role: admin
    routes:
    - backends:
      - host: localhost:8080
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

Later policies can now operate on the metadata associated with the API key. For example, you can set a custom `x-authenticated-user` header with the authenticated user from the API key metadata by adding a route-level transformation.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      apiKey:
        mode: strict
        keys:
        - key: sk-testkey-1
          metadata:
            user: test
            role: admin
    routes:
    - policies:
        transformations:
          request:
            set:
              x-authenticated-user: apiKey.user
      backends:
      - host: localhost:8080
```

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The apiKey config combined with a route-level transformation that sets a
#     header from API key metadata is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the x-authenticated-user header is actually set at runtime —
#     requires a backend the page omits to forward to and inspect.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      apiKey:
        mode: strict
        keys:
        - key: sk-testkey-1
          metadata:
            user: test
            role: admin
    routes:
    - policies:
        transformations:
          request:
            set:
              x-authenticated-user: apiKey.user
      backends:
      - host: localhost:8080
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}
