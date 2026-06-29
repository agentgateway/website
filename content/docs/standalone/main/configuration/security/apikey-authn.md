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

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="apikey-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
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

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
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
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The apiKey authentication policy is accepted by agentgateway in all three
#     configuration forms: routing-based (binds), simplified LLM (llm.policies),
#     and simplified MCP (mcp.policies).
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

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

Later policies can now operate on the metadata associated with the API key. For example, you can set a custom `x-authenticated-user` header with the authenticated user from the API key metadata by adding a route-level transformation.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
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
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The apiKey config combined with a transformation that sets a header from
#     API key metadata is accepted by agentgateway in all three configuration
#     forms: routing-based (binds), simplified LLM (llm.policies), and simplified
#     MCP (mcp.policies).
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

cat <<'EOF' > config2-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
EOF
agentgateway -f config2-llm.yaml --validate-only

cat <<'EOF' > config2-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config2-mcp.yaml --validate-only
{{< /doc-test >}}
