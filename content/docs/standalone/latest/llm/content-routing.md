---
title: Content-based routing
weight: 45
description: Route requests to different LLM backends based on request body content, such as the requested model name.
---

Route requests to different LLM backends based on the content of the request body, not just headers or path (also known as body-based routing or intelligent routing).

## About content-based routing

Content-based routing allows you to route requests to different backends based on fields in the request body, such as the `model` field in an LLM API request. This is useful when you want to:

- Route different models to different providers (e.g., `gpt-4` to OpenAI, `claude-3` to Anthropic)
- Direct certain models to specific backends based on cost or performance
- Route based on custom fields like user tier or priority level

Agentgateway implements content-based routing by using transformations to extract values from the request body into headers, then using header-based routing rules to select the appropriate backend.

### How it works

Content-based routing works in two steps:

1. **Extract body field to header**: Use a transformation policy to extract a field from the JSON request body (like `model`) into a custom header
2. **Match on header**: Use header matching in the route to route based on that header value

This pattern lets you route based on any field in the request body while using standard routing capabilities.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Route by model name

This example shows how to route requests to different backends based on the `model` field in the request body.

1. Create a configuration file with multiple routes that extract the `model` field from the request body and match on it. Each route uses a transformation to extract the model name into the `x-model` header, then matches on that header value.

   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   binds:
   - port: 3000
     listeners:
     - routes:
       # Route GPT models to OpenAI
       - matches:
         - path:
             pathPrefix: "/"
           headers:
           - name: "x-model"
             value:
               regex: "^gpt-.*"
         backends:
         - ai:
             name: openai
             provider:
               openAI:
                 model: gpt-4o
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
           transformations:
             request:
               set:
                 x-model: 'json(request.body).model'
           cors:
             allowOrigins:
               - "*"
             allowHeaders:
               - "*"
       # Route Claude models to Anthropic
       - matches:
         - path:
             pathPrefix: "/"
           headers:
           - name: "x-model"
             value:
               regex: "^claude-.*"
         backends:
         - ai:
             name: anthropic
             provider:
               anthropic:
                 model: claude-3-5-sonnet-latest
         policies:
           backendAuth:
             key: "$ANTHROPIC_API_KEY"
           transformations:
             request:
               set:
                 x-model: 'json(request.body).model'
           cors:
             allowOrigins:
               - "*"
             allowHeaders:
               - "*"
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description |
   | --- | --- |
   | `matches.headers.name` | The name of the header to match on. In this example, `x-model` is the custom header that contains the extracted model name. |
   | `matches.headers.value.regex` | A regular expression to match the header value. Routes with `^gpt-.*` match any model starting with "gpt", while `^claude-.*` matches any model starting with "claude". |
   | `transformations.request.set` | A CEL expression that extracts the `model` field from the JSON request body using `json(request.body).model` and sets it as the `x-model` header. |

2. Run the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

3. Send a request with `gpt-4o` in the model field. Verify that the request routes to the OpenAI backend.

   ```sh
   curl 'http://0.0.0.0:3000/' \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "gpt-4o",
     "messages": [
       {
         "role": "user",
         "content": "Say hello"
       }
     ]
   }' | jq -r '.model'
   ```

   Example output:
   ```
   gpt-4o-2024-08-06
   ```

4. Send a request with `claude-3-5-sonnet-latest` in the model field. Verify that the request routes to the Anthropic backend.

   ```sh
   curl 'http://0.0.0.0:3000/' \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "claude-3-5-sonnet-latest",
     "messages": [
       {
         "role": "user",
         "content": "Say hello"
       }
     ]
   }' | jq -r '.model'
   ```

   Example output:
   ```
   claude-3-5-sonnet-20241022
   ```

## Route by custom field

You can extract any field from the request body for routing decisions, not just the `model` field.

This example shows routing based on a custom `priority` field in the request body to route high-priority requests to a more powerful model.

```yaml
cat <<EOF > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    # High priority route
    - matches:
      - path:
          pathPrefix: "/"
        headers:
        - name: "x-priority"
          value:
            exact: "high"
      backends:
      - ai:
          name: openai-premium
          provider:
            openAI:
              model: gpt-4o
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
        transformations:
          request:
            set:
              x-priority: 'has(json(request.body).priority) ? json(request.body).priority : "standard"'
        cors:
          allowOrigins:
            - "*"
          allowHeaders:
            - "*"
    # Standard priority route (default)
    - matches:
      - path:
          pathPrefix: "/"
      backends:
      - ai:
          name: openai-standard
          provider:
            openAI:
              model: gpt-4o-mini
      policies:
        backendAuth:
          key: "$OPENAI_API_KEY"
        transformations:
          request:
            set:
              x-priority: 'has(json(request.body).priority) ? json(request.body).priority : "standard"'
        cors:
          allowOrigins:
            - "*"
          allowHeaders:
            - "*"
EOF
```

{{< callout type="info" >}}
The `has()` macro checks if a field exists in the JSON body before accessing it. This provides a default value if the field is missing, preventing errors when the custom field is not included in requests.
{{< /callout >}}

Test the routing by sending requests with different priority values:

```sh
# High priority request - routes to gpt-4o
curl 'http://0.0.0.0:3000/' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o",
  "priority": "high",
  "messages": [{"role": "user", "content": "Urgent request"}]
}' | jq -r '.model'
```

```sh
# Standard priority request - routes to gpt-4o-mini
curl 'http://0.0.0.0:3000/' \
--header 'Content-Type: application/json' \
--data '{
  "model": "gpt-4o",
  "messages": [{"role": "user", "content": "Normal request"}]
}' | jq -r '.model'
```

## Known limitations

When implementing content-based routing, be aware of these limitations:

- **Route order matters**: Routes are evaluated in the order they appear in the configuration. Place more specific routes (with header matches) before generic routes (without matches) to ensure proper routing.
- **Performance impact**: Extracting fields from the request body adds processing overhead. For high-throughput scenarios, consider using header-based routing when possible.
- **JSON parsing**: The `json()` CEL function requires valid JSON. Malformed JSON in the request body will cause routing failures.

## Next steps

- Learn about [transformations](../../configuration/traffic-management/transformations/) for more advanced request manipulation
- Set up [backend routing](../../configuration/routes/) for multiple backends
- Configure [rate limiting]({{< link-hextra path="/llm/spending/" >}}) to control costs per route
