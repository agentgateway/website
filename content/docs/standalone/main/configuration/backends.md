---
title: Backends
weight: 13
description: Configure backends to route traffic to hostnames, LLM providers, and MCP servers.
prev: /configuration/listeners
test:
  backends:
  - file: content/docs/standalone/main/configuration/backends.md
    path: backends
---

Agentgateway {{< gloss "Backend" >}}backends{{< /gloss >}} control where traffic is routed to.
Agentgateway supports a variety of backends, such as simple hostnames and IP addresses, {{< gloss "Provider" >}}LLM providers{{< /gloss >}}, and MCP servers.

{{< doc-test paths="backends" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/n-patch.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
export OPENAI_API_KEY="${OPENAI_API_KEY:-dummy}"
{{< /doc-test >}}

## Static Hosts

The simplest form of backend is a static hostname or IP address. For example:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes:
    - backends:
      - host: example.com:8080
        weight: 1
      - host: 127.0.0.1:80
        weight: 9
```

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The static host backend example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That traffic is actually routed/weighted to the hosts at runtime — requires
#     reachable backends the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - protocol: HTTP
    routes:
    - backends:
      - host: example.com:8080
        weight: 1
      - host: 127.0.0.1:80
        weight: 9
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}

## MCP Servers

The MCP backend allows you to connect to an MCP server.
Below shows a simple example, exposing a local and remote MCP server.
See the [MCP connectivity guide]({{< link-hextra path="/mcp/" >}}) for more information.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: stdio-server
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
          - name: http-server
            mcp:
              host: https://example.com/mcp
```

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The MCP backend example config (stdio + remote MCP targets) is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the MCP targets actually start/connect at runtime — requires the npx
#     command and remote server the page does not stand up.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          targets:
          - name: stdio-server
            stdio:
              cmd: npx
              args: ["@modelcontextprotocol/server-everything"]
          - name: http-server
            mcp:
              host: https://example.com/mcp
EOF
agentgateway -f config2.yaml --validate-only
{{< /doc-test >}}

### Session routing

By default, MCP backends use stateful session routing, where the gateway tracks session IDs and routes subsequent requests to the same upstream. For upstreams that do not maintain server-side session state, you can set `statefulMode: Stateless`. In stateless mode, the gateway automatically wraps each request with an initialization sequence, so the upstream server processes every request independently.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          statefulMode: Stateless
          targets:
          - name: openapi-server
            openapi:
              schema:
                url: https://petstore3.swagger.io/api/v3/openapi.json
```

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The stateless session-routing MCP backend example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That stateless wrapping actually occurs at runtime — requires the OpenAPI
#     upstream and live MCP traffic the page omits.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - mcp:
          statefulMode: Stateless
          targets:
          - name: openapi-server
            openapi:
              schema:
                url: https://petstore3.swagger.io/api/v3/openapi.json
EOF
agentgateway -f config3.yaml --validate-only
{{< /doc-test >}}

## LLM Providers

Agentgateway natively supports connecting to LLM providers, such as OpenAI and Anthropic.
Below shows a simple example, connecting to OpenAI.
See the [LLM consumption guide]({{< link-hextra path="/llm/" >}}) for more information.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
```

{{< doc-test paths="backends" >}}
# WHAT THIS TEST VALIDATES:
#   * The OpenAI LLM provider (ai backend) example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests are actually proxied to OpenAI at runtime — requires a real
#     OPENAI_API_KEY and live LLM traffic the page omits.
cat <<'EOF' > config4.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - backends:
      - ai:
          name: openai
          provider:
            openAI:
              model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
EOF
agentgateway -f config4.yaml --validate-only
{{< /doc-test >}}
