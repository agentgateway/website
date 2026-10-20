---
title: Transformations
weight: 12
description: Modify header and body information for requests and responses. 
test:
  transformations:
  - file: ${versionRoot}/documentation/configuration/traffic-management/transformations.md
    path: transformations
---

Attaches to: {{< badge content="Listener" path="/documentation/configuration/listeners/">}} {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="transformations" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export OPEN_AI_APIKEY="${OPEN_AI_APIKEY:-dummy}"
{{< /doc-test >}}

Agentgateway uses {{< gloss "Transformation" >}}transformation{{< /gloss >}} templates that are written in {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}}. CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

To learn more about how to use CEL, refer to the following resources:

- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)
- [Agentgateway reference docs](https://agentgateway.dev/docs/standalone/latest/reference/cel/)

> [!NOTE]
> Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway UI before using them in your configuration.

### Header transformation

You can add, set, or remove request and response headers with agentgateway's transformation policies. 

> [!NOTE]
> To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 

#### Route-level header transformation

Transform headers after route selection. You can configure the transformation in the UI or in your configuration file.

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the same `transformations` policy as the **Simplified (LLM)** example in the **Config file** tab.

1. Create a configuration with an LLM model, but no transformation policy. You add the policy in the UI.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPEN_AI_APIKEY"
   ```
2. Start agentgateway with this configuration.
3. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **Transformations** tile.
4. Expand **Request transformations**. In **Add headers**, add the following headers. For each header, enter the header name and the CEL expression, and click **Add**.
   1. `x-request-path` with `request.path`
   2. `x-client-ip` with `source.address`
5. Expand **Response transformations**.
   1. In **Add headers**, enter `x-response-code` and `string(response.code)`, and click **Add**.
   2. In **Remove headers**, add `server` and `x-content-type-options`. For each header, enter the name, and click **Add**.
6. Click **Save policy**.

You can also add a transformation policy in **MCP** > **Policies**, or in the **Route policies** section of a named route in **Traffic** > **Routes**. The **Routing-based** example uses an inline `ai` backend, which the UI edits only as raw YAML. For that example, use the **Config file** tab.

Whether the UI can save depends on your storage mode. For more information, see [Save changes from the UI]({{< link-hextra path="/documentation/setup/ui/launch-ui/#save-changes" >}}).
{{% /tab %}}
{{% tab name="Config file" %}}
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
gateways:
  default:
    port: 3000
routes:
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
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="transformations" >}}
# WHAT THIS TEST VALIDATES:
#   * The route-level header transformation example config is accepted by
#     agentgateway in all three configuration forms: routing-based (gateways),
#     simplified LLM (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime header rewriting and the AI backend call — requires a live OpenAI
#     backend and a real API key the page omits.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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
{{% tab name="UI" %}}
The following steps add the same `transformations` policy as the **Simplified (LLM)** example in the **Config file** tab.

1. Create a configuration with an LLM model, but no transformation policy. You add the policy in the UI.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPEN_AI_APIKEY"
   ```
2. Start agentgateway with this configuration.
3. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **Transformations** tile.
4. Expand **Request transformations**. In **Add headers**, enter `x-gateway` for the header name and `"agentgateway"` for the CEL expression, and click **Add**. The double quotes make the value a string. The UI saves the value as `'"agentgateway"'`.
5. Click **Save policy**.

For the **Routing-based** example, add the policy at the gateway level instead.

1. Open **Traffic** > **Gateways**, and click **Edit gateway** for the `default` gateway.
2. Click **Gateway policies**, and then click the **Transformations** tile.
3. Add the `x-gateway` header as described in step 4, and click **Save**.
4. Close the **Gateway policies** drawer, and click **Save gateway**.
{{% /tab %}}
{{% tab name="Config file" %}}
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
gateways:
  default:
    port: 3000
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
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="transformations" >}}
# WHAT THIS TEST VALIDATES:
#   * The listener-level header transformation example config is accepted by
#     agentgateway in all three configuration forms: routing-based (gateways),
#     simplified LLM (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime header injection and the AI backend call — requires a live OpenAI
#     backend and a real API key the page omits.
cat <<'EOF' > config2.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
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

When the `body` CEL expression returns a string or bytes value, the result replaces the original body. When the expression returns `null`, the original body is left unchanged. To send JSON `null`, return the string `"null"`. To clear the body, return an empty string. If the expression fails, the transformation returns an error before the body is replaced.

> [!NOTE]
> To provide a specific string value, add your string in single quotes `'` followed by double quotes `"`. This way, the string is interpreted as a string value. If you provide the value without quotes or with double quotes only, it is interpreted as a CEL expression. 

{{< tabs >}}
{{% tab name="UI" %}}
The following steps add the same `transformations` policy as the **Simplified (LLM)** example in the **Config file** tab.

1. Create a configuration with an LLM model, but no transformation policy. You add the policy in the UI.
   ```yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPEN_AI_APIKEY"
   ```
2. Start agentgateway with this configuration.
3. Open [http://localhost:15000/ui/llm/policies](http://localhost:15000/ui/llm/policies) (**LLM** > **Policies**), and click the **Transformations** tile.
4. Expand **Request transformations**, and enter `"Hello " + default(request.headers["x-user-name"], "guest")` for the **Body expression**.
5. Expand **Response transformations**, and enter `"Response code: " + string(response.code)` for the **Body expression**.
6. Click **Save policy**.

The UI saves each body expression as a single-quoted string instead of a `|` block. Both forms set the same expression.
{{% /tab %}}
{{% tab name="Config file" %}}
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
gateways:
  default:
    port: 3000
routes:
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
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="transformations" >}}
# WHAT THIS TEST VALIDATES:
#   * The body transformation example config is accepted by agentgateway in all
#     three configuration forms: routing-based (gateways), simplified LLM
#     (llm.policies), and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Runtime body rewriting — requires a backend the page omits to forward to
#     and inspect.
cat <<'EOF' > config3.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
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

To run a transformation only when a CEL expression matches, use the `conditional` field. For example, you can transform internal traffic only and leave external traffic untouched. For details, see [Conditional policies]({{< link-hextra path="/documentation/configuration/policies/conditional-policies" >}}).

