---
title: Prompt templates
weight: 55
description: Use static and dynamic prompt templates to customize LLM requests.
test:
  prompt-templates:
  - file: content/docs/standalone/latest/llm/prompt-templates.md
    path: prompt-templates
---

Use model-level transformations to dynamically customize LLM request parameters based on request context such as headers, user identity, or other runtime information. Agentgateway uses [CEL (Common Expression Language)](https://agentgateway.dev/docs/standalone/latest/reference/cel/) expressions to evaluate and set LLM request fields at runtime.

## About LLM transformations

Model-level transformations allow you to dynamically compute LLM request fields using CEL expressions that can reference incoming request headers, existing request fields, and other context. This is useful for enforcing per-user policies, customizing model behavior based on caller identity, and applying conditional request modifications without changing client code.

To learn more about CEL, see the following resources:

- [CEL expression reference]({{< link-hextra path="/reference/cel/" >}})
- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)

{{< callout type="info" >}}
Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/" >}}#cel-playground) in the agentgateway admin UI before using them in your configuration.
{{< /callout >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="prompt-templates" >}}
# Install agentgateway binary
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
VERSION="v{{< reuse "agw-docs/versions/patch-dev.md" >}}"
BINARY_URL="https://github.com/agentgateway/agentgateway/releases/download/${VERSION}/agentgateway-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/')"
curl -sL "$BINARY_URL" -o "$HOME/.local/bin/agentgateway"
chmod +x "$HOME/.local/bin/agentgateway"
export OPENAI_API_KEY="${OPENAI_API_KEY:-<your-api-key>}"
{{< /doc-test >}}

## Conditionally set max tokens based on user identity

Use a CEL expression in the model-level `transformation` field to dynamically set `max_tokens` based on the caller's identity from a request header. This example gives admin users a higher token limit than regular users.

```yaml {paths="prompt-templates"}
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      max_tokens: "request.headers['x-user-id'] == 'admin' ? 100 : 10"
EOF
```

The response follows the prepended and appended guidelines even though they were not in the original request.

## Dynamic prompt templates

Dynamic templates use CEL transformations to inject variables from the request context into prompts. This is ideal for personalizing prompts with user identity, adding request metadata, or applying conditional prompt modification based on headers or claims.

{{< callout type="info" >}}
JWT claims in transformations require JWT authentication to be configured. See the [authentication documentation](https://agentgateway.dev/docs/standalone/latest/configuration/security/jwt-authn/) for setup instructions.
{{< /callout >}}

### Inject user identity from headers

Configure transformations to inject user identity from request headers into the prompt.

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
        transformations:
          request:
            body: |
              json(request.body).with(body,
                {
                  "model": body.model,
                  "messages": [{"role": "system", "content": "You are assisting user: " + default(request.headers["x-user-id"], "anonymous")}]
                    + body.messages
                }
              ).toJson()
```

Send a request as a regular user and verify the response is capped at the lower token limit.

```sh {paths="prompt-templates"}
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-user-id: alice" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Tell me a story"}]
  }' | jq .
```

{{< doc-test paths="prompt-templates" >}}
YAMLTest -f - <<'EOF'
- name: admin user gets higher token limit
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      x-user-id: admin
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Tell me a story"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.completion_tokens"
        comparator: equals
        value: 100

- name: regular user gets lower token limit
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      x-user-id: alice
    body: |
      {
        "model": "gpt-3.5-turbo",
        "messages": [{"role": "user", "content": "Tell me a story"}]
      }
  source:
    type: local
  expect:
    statusCode: 200
    bodyJsonPath:
      - path: "$.usage.completion_tokens"
        comparator: equals
        value: 10
EOF
{{< /doc-test >}}

In the responses, the admin user receives up to 100 completion tokens while the regular user is capped at 10.

## Available CEL variables

You can use these variables in your CEL transformation expressions.

| Variable | Description | Example |
|----------|-------------|---------|
| `request.headers["name"]` | Request header values | `request.headers["x-user-id"]` |
| `request.path` | Request path | `request.path` returns `/` |
| `request.method` | HTTP method | `request.method` returns `POST` |
| `llmRequest.max_tokens` | Original max_tokens from the request | `min(llmRequest.max_tokens, 100)` |
| `llmRequest.model` | Requested model name | `llmRequest.model` |

For a complete list of available variables and functions, see the [CEL reference documentation](/docs/reference/cel/).

## Common transformation patterns

### Cap token usage

Enforce a maximum token limit regardless of what the client requests.

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      max_tokens: "min(llmRequest.max_tokens, 1024)"
```

### Set temperature based on headers

Allow callers to control creativity through a header while enforcing bounds.

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      temperature: "request.headers['x-creativity'] == 'high' ? 0.9 : 0.1"
```

### Combine multiple transformations

Apply several field-level transformations in a single configuration.

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
    transformation:
      max_tokens: "request.headers['x-user-tier'] == 'premium' ? 4096 : 256"
      temperature: "request.headers['x-user-tier'] == 'premium' ? 0.8 : 0.3"
```

## Next steps

- Learn about [CEL expressions]({{< link-hextra path="reference/cel/">}}) for advanced expression logic.
- Explore [transformations]({{< link-hextra path="/llm/transformations/" >}}) for more LLM request transformation examples.
- Set up [authentication]({{< link-hextra path="configuration/security/jwt-authn/" >}}) to use JWT claims in transformations.
