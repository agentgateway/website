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

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Static prompt templates

Static templates use prompt enrichment to prepend or append fixed messages to every request. This is ideal for setting consistent behavior guidelines, adding organizational policies, or defining output formats.

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource with static prompt enrichment.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: static-prompt-template
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
     backend:
       ai:
         prompt:
           prepend:
           - role: system
             content: "You are a helpful customer service assistant. Always be polite and professional."
           append:
           - role: system
             content: "If you cannot answer a question, say so clearly rather than making up information."
   EOF
   ```

2. Send a request without system prompts. The static template is automatically applied.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json -d '{
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "How do I return a product?"
       }
     ]
   }' | jq -r '.choices[].message.content'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" -H content-type:application/json -d '{
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "How do I return a product?"
       }
     ]
   }' | jq -r '.choices[].message.content'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   The response follows the prepended and appended guidelines even though they were not in the original request.

## Dynamic prompt templates

Dynamic templates use CEL transformations to inject variables from the request context into prompts. This is ideal for personalizing prompts with user identity, adding request metadata, or applying conditional prompt modification based on headers or claims.

{{< callout type="info" >}}
JWT claims in transformations require JWT authentication to be configured. See the [JWT authentication guide]({{< link-hextra path="/security/jwt/">}}) for setup instructions.
{{< /callout >}}

### Inject user identity from headers

1. Create an {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} resource that injects user identity from request headers.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
   metadata:
     name: dynamic-prompt-template
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
     traffic:
       transformation:
         request:
           body: |
             json(request.body).with(body,
               {
                 "model": body.model,
                 "messages": [{"role": "system", "content": "You are assisting user: " + default(request.headers["x-user-id"], "anonymous")}]
                   + body.messages
               }
             ).toJson()
   EOF
   ```

2. Send a request with a user ID header.

   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}
   {{% tab tabName="Cloud Provider LoadBalancer" %}}
   ```sh
   curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json -H "x-user-id: alice" -d '{
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "What are my recent orders?"
       }
     ]
   }' | jq -r '.choices[].message.content'
   ```
   {{% /tab %}}
   {{% tab tabName="Port-forward for local testing" %}}
   ```sh
   curl "localhost:8080/openai" -H content-type:application/json -H "x-user-id: alice" -d '{
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "What are my recent orders?"
       }
     ]
   }' | jq -r '.choices[].message.content'
   ```
   {{% /tab %}}
   {{< /tabs >}}

   The request body includes a system message: `"You are assisting user: alice"`.

### Available CEL variables for templating

You can use these variables in your CEL transformation expressions.

| Variable | Description | Example |
|----------|-------------|---------|
| `request.headers["name"]` | Request header values | `request.headers["x-user-id"]` |
| `request.path` | Request path | `request.path` returns `/openai` |
| `request.method` | HTTP method | `request.method` returns `POST` |
| `jwt.sub` | JWT subject claim | `jwt.sub` returns `"user123"` |
| `jwt.iss` | JWT issuer claim | `jwt.iss` returns `"https://auth.example.com"` |
| `jwt.aud` | JWT audience claim | `jwt.aud` returns `"api://myapp"` |
| `jwt['custom-claim']` | Custom JWT claims | `jwt['org-id']` returns custom claim value |

For a complete list of available variables and functions, see the [CEL reference documentation](https://agentgateway.dev/docs/standalone/latest/reference/cel/).

## Common templating patterns

### User context from JWT claims

{{< callout type="warning" >}}
JWT claims are not currently available in CEL transformations when using `mcpAuthentication`. This is tracked in [agentgateway issue #870](https://github.com/agentgateway/agentgateway/issues/870). Use `jwtAuthentication` in the traffic policy instead.
{{< /callout >}}

Inject user identity and organization from JWT claims into the prompt.

```yaml
traffic:
  transformation:
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
traffic:
  transformation:
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
traffic:
  transformation:
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
# Static guidelines via prompt enrichment
backend:
  ai:
    prompt:
      prepend:
      - role: system
        content: "You are a helpful assistant. Always be polite."
      append:
      - role: system
        content: "If uncertain, say so clearly."

# Dynamic user context via transformation
traffic:
  transformation:
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

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} static-prompt-template dynamic-prompt-template -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```

## Next steps

- Learn about [CEL expressions](https://agentgateway.dev/docs/standalone/latest/reference/cel/) for advanced templating.
- Explore [transformations]({{< link-hextra path="/traffic-management/transformations/">}}) for request/response modification.
- Set up [JWT authentication]({{< link-hextra path="/security/jwt/">}}) to use JWT claims in templates.
