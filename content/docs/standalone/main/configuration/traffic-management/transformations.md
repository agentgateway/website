---
title: Transformations
weight: 12
description: Modify header and body information for requests and responses. 
test:
  transformations:
  - file: content/docs/standalone/main/configuration/traffic-management/transformations.md
    path: transformations
---

Attaches to: {{< badge content="Listener" path="/configuration/listeners/">}} {{< badge content="Route" path="/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="transformations" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export OPEN_AI_APIKEY="${OPEN_AI_APIKEY:-dummy}"
{{< /doc-test >}}

Agentgateway uses {{< gloss "Transformation" >}}transformation{{< /gloss >}} templates that are written in {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}}. CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

To learn more about how to use CEL, refer to the following resources:

- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)
- [Agentgateway reference docs](https://agentgateway.dev/docs/standalone/latest/reference/cel/)

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway admin UI before using them in your configuration.
{{< /callout >}}

### Header transformation

You can add, set, or remove request and response headers with agentgateway's transformation policies. 

{{< callout type="info" >}}
To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 
{{< /callout >}}

#### Route-level header transformation

Transform headers after route selection:

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    transformations:
      request:
        add:
          x-request-path: request.path
          x-client-ip: source.address
      response:
        add:
          x-response-code: 'string(response.code)'
        remove:
        - server
        - x-content-type-options
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPEN_AI_APIKEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    transformations:
      request:
        add:
          x-request-path: request.path
          x-client-ip: source.address
      response:
        add:
          x-response-code: 'string(response.code)'
        remove:
        - server
        - x-content-type-options
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
  - routes:
    - backends:
      - ai:
         name: openai
         provider:
           openAI:
             # Optional; overrides the model in requests
             model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPEN_AI_APIKEY"
        cors:
          allowOrigins:
            - "*"
          allowHeaders:
            - "*"
        transformations:
          request:
            add:
              x-request-path: request.path
              x-client-ip: source.address
          response:
            add:
              x-response-code: 'string(response.code)'
            remove:
            - server
            - x-content-type-options
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="transformations" >}}
# WHAT THIS TEST VALIDATES:
#   * The route-level header transformation example config is accepted by
#     agentgateway in all three configuration forms: routing-based (binds),
#     simplified LLM (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime header rewriting and the AI backend call — requires a live OpenAI
#     backend and a real API key the page omits.
cat <<'EOF' > config.yaml
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
             # Optional; overrides the model in requests
             model: gpt-3.5-turbo
      policies:
        backendAuth:
          key: "$OPEN_AI_APIKEY"
        cors:
          allowOrigins:
            - "*"
          allowHeaders:
            - "*"
        transformations:
          request:
            add:
              x-request-path: request.path
              x-client-ip: source.address
          response:
            add:
              x-response-code: 'string(response.code)'
            remove:
            - server
            - x-content-type-options
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    transformations:
      request:
        add:
          x-request-path: request.path
          x-client-ip: source.address
      response:
        add:
          x-response-code: 'string(response.code)'
        remove:
        - server
        - x-content-type-options
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPEN_AI_APIKEY"
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    transformations:
      request:
        add:
          x-request-path: request.path
          x-client-ip: source.address
      response:
        add:
          x-response-code: 'string(response.code)'
        remove:
        - server
        - x-content-type-options
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

#### Listener-level header transformation

Transform headers before route selection by attaching the policy at the listener level:

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    transformations:
      request:
        add:
          x-gateway: '"agentgateway"'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPEN_AI_APIKEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    transformations:
      request:
        add:
          x-gateway: '"agentgateway"'
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
      transformations:
        request:
          add:
            x-gateway: '"agentgateway"'
    routes:
    - policies:
        backendAuth:
          key: "$OPEN_AI_APIKEY"
      backends:
      - ai:
         name: openai
         provider:
           openAI:
             model: gpt-3.5-turbo
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="transformations" >}}
# WHAT THIS TEST VALIDATES:
#   * The listener-level header transformation example config is accepted by
#     agentgateway in all three configuration forms: routing-based (binds),
#     simplified LLM (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime header injection and the AI backend call — requires a live OpenAI
#     backend and a real API key the page omits.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - policies:
      transformations:
        request:
          add:
            x-gateway: '"agentgateway"'
    routes:
    - policies:
        backendAuth:
          key: "$OPEN_AI_APIKEY"
      backends:
      - ai:
         name: openai
         provider:
           openAI:
             model: gpt-3.5-turbo
EOF
agentgateway -f config2.yaml --validate-only

cat <<'EOF' > config2-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    transformations:
      request:
        add:
          x-gateway: '"agentgateway"'
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPEN_AI_APIKEY"
EOF
agentgateway -f config2-llm.yaml --validate-only

cat <<'EOF' > config2-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    transformations:
      request:
        add:
          x-gateway: '"agentgateway"'
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config2-mcp.yaml --validate-only
{{< /doc-test >}}

### Body transformation

You can provide a custom body for a request or response. 

{{< callout type="info" >}}
To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 
{{< /callout >}}

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    transformations:
      request:
        body: |
          "Hello " + default(request.headers["x-user-name"], "guest")
      response:
        body: |
          "Response code: " + string(response.code)
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPEN_AI_APIKEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    transformations:
      request:
        body: |
          "Hello " + default(request.headers["x-user-name"], "guest")
      response:
        body: |
          "Response code: " + string(response.code)
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
  - routes:
    - policies:
        transformations:
          request:
            body: |
              "Hello " + default(request.headers["x-user-name"], "guest")
          response:
            body: |
              "Response code: " + string(response.code)
      backends:
      - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

{{< doc-test paths="transformations" >}}
# WHAT THIS TEST VALIDATES:
#   * The body transformation example config is accepted by agentgateway in all
#     three configuration forms: routing-based (binds), simplified LLM
#     (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime body rewriting — requires a backend the page omits to forward to
#     and inspect.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        transformations:
          request:
            body: |
              "Hello " + default(request.headers["x-user-name"], "guest")
          response:
            body: |
              "Response code: " + string(response.code)
      backends:
      - host: localhost:8080
EOF
agentgateway -f config3.yaml --validate-only

cat <<'EOF' > config3-llm.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    transformations:
      request:
        body: |
          "Hello " + default(request.headers["x-user-name"], "guest")
      response:
        body: |
          "Response code: " + string(response.code)
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPEN_AI_APIKEY"
EOF
agentgateway -f config3-llm.yaml --validate-only

cat <<'EOF' > config3-mcp.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    transformations:
      request:
        body: |
          "Hello " + default(request.headers["x-user-name"], "guest")
      response:
        body: |
          "Response code: " + string(response.code)
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
EOF
agentgateway -f config3-mcp.yaml --validate-only
{{< /doc-test >}}

## Conditional execution

To run a transformation only when a CEL expression matches, use the `conditional` field. For example, you can transform internal traffic only and leave external traffic untouched. For details, see [Conditional policies]({{< link-hextra path="/configuration/policies/conditional-policies" >}}).

