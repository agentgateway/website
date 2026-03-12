---
title: Transform requests
weight: 55
description: Dynamically compute and set LLM request fields using CEL expressions.
---

Use LLM request transformations to dynamically compute and set fields in LLM requests using {{< gloss "CEL (Common Expression Language)" >}}Common Expression Language (CEL){{< /gloss >}} expressions. Transformations let you enforce policies such as capping token usage or conditionally modifying request parameters, without changing client code.

To learn more about CEL, see the following resources:

- [CEL expression reference]({{< link-hextra path="/reference/cel/" >}})
- [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure LLM request transformations

1. Create a configuration file with your LLM transformation settings. The following example caps `max_tokens` to 10, regardless of what the client requests.
   ```yaml
   cat <<EOF > config.yaml
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
           ai:
             transformations:
               max_tokens: "min(llmRequest.max_tokens, 10)"
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `ai.transformations` | A map of LLM request field names to CEL expressions. Each key is the field to set; each value is a CEL expression evaluated against the original request. Use the `llmRequest` variable to access the original LLM request body. |

   {{< callout type="info" >}}
   You can specify up to 64 transformations per policy. Transformations take priority over `overrides` for the same field. If an expression fails to evaluate, the field is silently removed from the request.
   {{< /callout >}}

2. Run the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

3. Send a request with `max_tokens` set to a value greater than 1024. The transformation caps it to 10 before the request reaches the LLM provider.
   ```sh
   curl 'http://0.0.0.0:3000/' \
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
   }'
   ```

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
