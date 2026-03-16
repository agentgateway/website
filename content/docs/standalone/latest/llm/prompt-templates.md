---
title: Prompt templates
weight: 55
description: Use static and dynamic prompt templates to customize LLM requests.
---

Use prompt templates to inject dynamic context, user identity, or other runtime information into your LLM prompts. Agentgateway supports both static template patterns (prepend/append) and dynamic variable-based templating using CEL expressions.

## About prompt templates

Prompt templates allow you to standardize prompts across your organization with consistent instructions, inject dynamic context such as user identity or JWT claims, customize behavior per user, and add metadata like request IDs for tracking.

Unlike simple `{{variable}}` substitution systems, agentgateway uses [CEL (Common Expression Language)](https://agentgateway.dev/docs/standalone/latest/reference/cel/) expressions. This gives you full expression logic including conditionals, functions, and complex transformations.

## Templating approaches

Agentgateway provides two complementary approaches to prompt templating.

| Approach | Use Case | Example |
|----------|----------|---------|
| Static templates | Fixed prompts that apply to all requests | "Answer all questions in French." |
| Dynamic templates | Variable injection from JWT claims, headers, or request context | "You are assisting user `{jwt.sub}` from organization `{jwt.org}`." |

You can use these approaches individually or combine them for maximum flexibility.

## Static prompt templates

Static templates prepend or append fixed messages to every request. This is ideal for setting consistent behavior guidelines, adding organizational policies, or defining output formats.

Configure static templates in your route's `policies` section.

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
        promptEnrichment:
          prepend:
          - role: system
            content: "You are a helpful customer service assistant. Always be polite and professional."
          append:
          - role: system
            content: "If you cannot answer a question, say so clearly rather than making up information."
```

With this configuration, every request includes the prepended and appended system messages, even if the client does not send them.

Test with curl.

```sh
curl "localhost:3000" -H content-type:application/json -d '{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "How do I return a product?"
    }
  ]
}' | jq -r '.choices[].message.content'
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

Test with a user ID header.

```sh
curl "localhost:3000" -H content-type:application/json -H "x-user-id: alice" -d '{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "What are my recent orders?"
    }
  ]
}' | jq -r '.choices[].message.content'
```

The request body includes a system message: `"You are assisting user: alice"`.

### Available CEL variables for templating

You can use these variables in your CEL transformation expressions.

| Variable | Description | Example |
|----------|-------------|---------|
| `request.headers["name"]` | Request header values | `request.headers["x-user-id"]` |
| `request.path` | Request path | `request.path` returns `/` |
| `request.method` | HTTP method | `request.method` returns `POST` |
| `jwt.sub` | JWT subject claim | `jwt.sub` returns `"user123"` |
| `jwt.iss` | JWT issuer claim | `jwt.iss` returns `"https://auth.example.com"` |
| `jwt.aud` | JWT audience claim | `jwt.aud` returns `"api://myapp"` |
| `jwt['custom-claim']` | Custom JWT claims | `jwt['org-id']` returns custom claim value |

For a complete list of available variables and functions, see the [CEL reference documentation](/docs/reference/cel/).

## Common templating patterns

### User context from JWT claims

{{< callout type="warning" >}}
JWT claims are not currently available in CEL transformations when using `mcpAuthentication`. This is tracked in [agentgateway issue #870](https://github.com/agentgateway/agentgateway/issues/870). Use `jwtAuth` in the route policies instead.
{{< /callout >}}

Inject user identity and organization from JWT claims into the prompt.

```yaml
policies:
  transformations:
    request:
      body: |
        json(request.body).with(body,
          {
            "model": body.model,
            "messages": [
              {
                "role": "system",
                "content": "You are assisting " + jwt.sub + " from organization " + jwt['org-id'] + ". Tailor responses to their role: " + default(jwt.role, "user") + "."
              }
            ] + body.messages
          }
        ).toJson()
```

### Conditional templates based on headers

Route premium users to enhanced instructions.

```yaml
policies:
  transformations:
    request:
      body: |
        json(request.body).with(body,
          request.headers["x-user-tier"] == "premium" ?
            {
              "model": body.model,
              "messages": [{"role": "system", "content": "Provide detailed, comprehensive answers with examples."}] + body.messages
            } :
            {
              "model": body.model,
              "messages": [{"role": "system", "content": "Provide concise, brief answers."}] + body.messages
            }
        ).toJson()
```

### Add request tracking metadata

Inject request ID and timestamp for debugging.

```yaml
policies:
  transformations:
    request:
      body: |
        json(request.body).with(body,
          {
            "model": body.model,
            "messages": [
              {
                "role": "system",
                "content": "Request ID: " + uuid() + " | Timestamp: " + string(request.startTime)
              }
            ] + body.messages
          }
        ).toJson()
```

### Combine static and dynamic templates

Use prompt enrichment for static guidelines and transformations for dynamic context.

```yaml
policies:
  # Static guidelines via prompt enrichment
  promptEnrichment:
    prepend:
    - role: system
      content: "You are a helpful assistant. Always be polite."
    append:
    - role: system
      content: "If uncertain, say so clearly."

  # Dynamic user context via transformation
  transformations:
    request:
      body: |
        json(request.body).with(body,
          {
            "model": body.model,
            "messages": body.messages + [
              {
                "role": "system",
                "content": "User context: " + default(request.headers["x-user-id"], "anonymous")
              }
            ]
          }
        ).toJson()
```

This applies both static prompts (prepend/append) and dynamic user context (from headers).

## Next steps

- Learn about [CEL expressions](/docs/reference/cel/) for advanced templating.
- Explore [transformations](/docs/configuration/traffic-management/transformations/) for request/response modification.
- Set up [authentication](https://agentgateway.dev/docs/standalone/latest/configuration/security/jwt-authn/) to use JWT claims in templates.
