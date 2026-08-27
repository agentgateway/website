---
title: Transform requests
weight: 55
description: Dynamically compute and set LLM request fields using CEL expressions.
test:
  transformations:
  - file: ${versionRoot}/llm/transformations.md
    path: transformations
---

Use LLM request transformations to dynamically compute and set fields in LLM requests using {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}} expressions. Transformations let you enforce policies such as capping token usage or conditionally modifying request parameters, without changing client code.

To learn more about CEL, see the following resources:

- [CEL expression reference]({{< link-hextra path="/reference/cel/" >}})
- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)

> [!NOTE]
> Try out CEL expressions in the built-in [CEL playground]({{< link-hextra path="/reference/cel/playground/" >}}) in the agentgateway UI before using them in your configuration.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

{{< doc-test paths="transformations" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * All three example configs are accepted by agentgateway (--validate-only), so
#     the `transformation` and `finalTransformation` fields and their CEL
#     expressions are correct.
#   * "Configure LLM request transformations": a client request that asks for 5000
#     max_tokens reaches the provider capped at 10.
#   * "Conditionally set fields based on headers": the same request reaches the
#     provider with 100 max_tokens as an admin user and 10 as a regular user.
#   * "Transform requests after provider conversion": a request that asks for 5000
#     max_tokens reaches the provider with max_completion_tokens capped at 10,
#     which only holds if the transformation ran AFTER the conversion renamed the
#     field. A pre-conversion transformation on max_completion_tokens would not
#     produce this result.
#
# HOW THE ASSERTIONS WORK:
#   The tests run against a local mock LLM instead of OpenAI, so no provider API
#   key is needed and no live completion is billed. The mock reports the
#   max_tokens value it received as usage.completion_tokens, so asserting on
#   completion_tokens asserts what agentgateway actually sent upstream - which is
#   what these transformations are documented to change.
# Install agentgateway binary
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< reuse "agw-docs/snippets/start-mock-llm.md" >}}
{{< /doc-test >}}

## Configure LLM request transformations

1. Create a configuration file with your LLM transformation settings. The following example caps `max_tokens` to 10, regardless of what the client requests.
   ```yaml {paths="transformations"}
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
       transformation:
         max_tokens: "min(llmRequest.max_tokens, 10)"
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `transformation` | A map of LLM request field names to CEL expressions. Each key is the field to set; each value is a CEL expression evaluated against the original request. Use the `llmRequest` variable to access the original LLM request body. |

   > [!NOTE]
   > Transformations take priority over `overrides` for the same field. If an expression fails to evaluate, the field is silently removed from the request.

2. Run the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="transformations" >}}
   # Cap max_tokens: validate the documented config, then run it against the mock LLM.
   {{< reuse "agw-docs/snippets/point-config-at-mock-llm.md" >}}
   agentgateway -f config-mock.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID $MOCK_LLM_PID 2>/dev/null' EXIT
   sleep 3
   {{< /doc-test >}}

3. Send a request with `max_tokens` set to a value greater than 1024. The transformation caps it to 10 before the request reaches the LLM provider.
   ```sh {paths="transformations"}
   curl -s 'http://localhost:4000/v1/chat/completions' \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "gpt-3.5-turbo",
     "max_tokens": 5000,
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }' | jq .
   ```

   {{< doc-test paths="transformations" >}}
   YAMLTest -f - <<'EOF'
   - name: request with max_tokens transformation returns capped completion
     http:
       url: "http://localhost:4000"
       path: /v1/chat/completions
       method: POST
       headers:
         content-type: application/json
       body: |
         {
           "model": "gpt-3.5-turbo",
           "max_tokens": 5000,
           "messages": [{"role": "user", "content": "Tell me a short story"}]
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

   Example output:
   ```console {hl_lines=[2]}
   {"model":"gpt-3.5-turbo-0125","usage":
   {"prompt_tokens":12,"completion_tokens":10,
   "total_tokens":22,"completion_tokens_details":
   {"reasoning_tokens":0,"audio_tokens":0,
   "accepted_prediction_tokens":0,
   "rejected_prediction_tokens":0},"prompt_tokens_details":
   {"cached_tokens":0,"audio_tokens":0}},"choices":
   [{"message":{"content":"Once upon a time, in a quaint
   village nestled","role":"assistant","refusal":null,
   "annotations":[]},"index":0,"logprobs":null,
   "finish_reason":"length"}],
   "id":"chatcmpl-DHyGUsdgf2P5FidTbZIZFxdVGRfpq",
   "object":"chat.completion","created":1773175606,
   "service_tier":"default","system_fingerprint":null}%
   ```

   In the response, the `completion_tokens` value reflects a completion capped at 10 tokens.

## Conditionally set fields based on headers

Use a CEL expression in the model-level `transformation` field to dynamically set `max_tokens` based on the caller's identity from a request header. This example gives admin users a higher token limit than regular users.

```yaml {paths="transformations"}
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

| Setting | Description |
| -- | -- |
| `transformation` | A map of LLM request field names to CEL expressions. Each key is the field to set; each value is a CEL expression evaluated against the original request. Use `request.headers` to access incoming HTTP headers and `llmRequest` to access the original LLM request body. |

{{< doc-test paths="transformations" >}}
# Header-conditional max_tokens: restart the gateway on the second config, again
# pointed at the mock LLM. This block must stay textually different from the
# restart block in the previous section: the extractor silently drops a block whose
# content is byte-identical to one it already selected, which would leave the
# assertions below running against the previous section's config.
kill $AGW_PID 2>/dev/null
sleep 1
{{< reuse "agw-docs/snippets/point-config-at-mock-llm.md" >}}
agentgateway -f config-mock.yaml &
AGW_PID=$!
trap 'kill $AGW_PID $MOCK_LLM_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

Send a request as an admin user and verify the response uses the higher token limit.

```sh {paths="transformations"}
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-user-id: admin" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Tell me a story"}]
  }' | jq .
```

Send a request as a regular user and verify the response is capped at the lower token limit.

```sh {paths="transformations"}
curl -s http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-user-id: alice" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Tell me a story"}]
  }' | jq .
```

{{< doc-test paths="transformations" >}}
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

## Transform requests after provider conversion

The `transformation` field runs before agentgateway converts the request into the format that the provider expects. To write one, you must know how the conversion works, and you cannot change a field that the conversion itself adds.

The `finalTransformation` field runs after the conversion instead. You only need to know the shape of the target API.

The difference shows in the field names. When a client sends `max_tokens` to an OpenAI provider, the conversion renames the field to `max_completion_tokens`, so the provider receives the following request body.

```json
{
  "model": "gpt-3.5-turbo",
  "max_completion_tokens": 5000,
  "messages": [{"role": "user", "content": "Tell me a short story"}]
}
```

A `transformation` entry must target `max_tokens`, the name that the client sent. A `finalTransformation` entry must target `max_completion_tokens`, the name that the provider receives.

1. Create a configuration file that caps the converted field and removes a field from the provider request. The `min()` expression caps `max_completion_tokens` at 10. The `fail("remove")` expression always fails to evaluate, which deletes `reasoning_effort` from the request.

   ```yaml {paths="transformations"}
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         apiKey: "$OPENAI_API_KEY"
       finalTransformation:
         max_completion_tokens: "min(llmRequest.max_completion_tokens, 10)"
         reasoning_effort: 'fail("remove")'
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `finalTransformation` | A map of provider request field names to CEL expressions. Each key is the field to set in the converted request; each value is a CEL expression. Entries take priority over `overrides` for the same field. |

   > [!WARNING]
   > In a `finalTransformation` expression, `llmRequest` is the **converted** request body, not the request that the client sent. An expression that reads a field which the converted body does not have, such as `llmRequest.max_tokens` for an OpenAI provider, fails to evaluate. A failed expression removes the target field, so a mistyped field name silently deletes the field that you meant to set. For more information about the expression language, see the [CEL reference]({{< link-hextra path="/reference/cel/" >}}).

2. Run the agentgateway.

   ```sh
   agentgateway -f config.yaml
   ```

   {{< doc-test paths="transformations" >}}
   # Post-conversion transformations: restart the gateway on the third config of this
   # guide, again pointed at the mock LLM. The comment differs from the two restart
   # blocks in the preceding sections on purpose: the extractor drops a block whose
   # content is byte-identical to one it already selected, which would leave the
   # assertion below running against the header-conditional config.
   kill $AGW_PID 2>/dev/null
   sleep 1
   {{< reuse "agw-docs/snippets/point-config-at-mock-llm.md" >}}
   agentgateway -f config-mock.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID $MOCK_LLM_PID 2>/dev/null' EXIT
   sleep 3
   {{< /doc-test >}}

3. Send a request that sets `max_tokens` and `reasoning_effort`. The conversion renames `max_tokens` to `max_completion_tokens`, and the transformation then caps that field at 10 and drops `reasoning_effort`.

   ```sh {paths="transformations"}
   curl -s 'http://localhost:4000/v1/chat/completions' \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "gpt-3.5-turbo",
     "max_tokens": 5000,
     "reasoning_effort": "high",
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }' | jq .
   ```

   {{< doc-test paths="transformations" >}}
   YAMLTest -f - <<'EOF'
   - name: post-conversion transformation caps the converted field
     http:
       url: "http://localhost:4000"
       path: /v1/chat/completions
       method: POST
       headers:
         content-type: application/json
       body: |
         {
           "model": "gpt-3.5-turbo",
           "max_tokens": 5000,
           "reasoning_effort": "high",
           "messages": [{"role": "user", "content": "Tell me a short story"}]
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

   Example output:

   ```console {hl_lines=[2]}
   {"model":"gpt-3.5-turbo-0125","usage":
   {"prompt_tokens":12,"completion_tokens":10,
   "total_tokens":22},"choices":
   [{"message":{"content":"Once upon a time, in a quaint
   village nestled","role":"assistant"},"index":0,
   "finish_reason":"length"}],
   "id":"chatcmpl-DHyGUsdgf2P5FidTbZIZFxdVGRfpq",
   "object":"chat.completion","created":1773175606}%
   ```

   The `completion_tokens` value reflects a completion capped at 10 tokens, which confirms that the transformation reached the converted request.

## Available CEL variables

You can use these variables in your CEL transformation expressions.

| Variable | Description | Example |
|----------|-------------|---------|
| `request.headers["name"]` | Request header values | `request.headers["x-user-id"]` |
| `request.path` | Request path | `request.path` returns `/` |
| `request.method` | HTTP method | `request.method` returns `POST` |
| `llmRequest.max_tokens` | Original max_tokens from the request | `min(llmRequest.max_tokens, 100)` |
| `llmRequest.model` | Requested model name | `llmRequest.model` |

> [!NOTE]
> What `llmRequest` refers to depends on which field holds the expression. In a `transformation` entry, `llmRequest` is the request that the client sent. In a `finalTransformation` entry, `llmRequest` is the request after agentgateway converts it into the provider's format.

For a complete list of available variables and functions, see the [CEL reference documentation]({{< link-hextra path="/reference/cel/" >}}).

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

- Learn about [CEL expressions]({{< link-hextra path="/reference/cel/" >}}) for advanced expression logic.
- Set up [authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}) to use JWT claims in transformations.
