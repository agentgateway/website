---
title: OpenAI moderation
weight: 15
description: Use the OpenAI Moderation API as a prompt guard to screen LLM traffic for harmful content.
---

The OpenAI Moderation API detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence.

## About the two moderation options

Two separate features use the OpenAI Moderation API, and they have similar names. This page covers both. Read the following table to choose the one that fits your use case.

| Area | Moderation prompt guard | Inline moderation |
| -- | -- | -- |
| Configuration field | `openAIModeration`, in a guardrail | `moderation`, on the OpenAI provider of a backend |
| What performs the check | agentgateway calls the Moderation API | OpenAI moderates as part of the completion request |
| Extra call to OpenAI per request | Yes | No |
| Supported providers | Any provider that the guardrail targets | OpenAI only |
| Result when content is flagged | agentgateway returns a 403 response with the message that you configure | OpenAI returns the completion with moderation results attached |
| Stops the request | Yes | No |

The two features are independent, and enabling one does not change the other. You can configure both at the same time, and combining them is the way to get both a hard block and per-category moderation scores.

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Block harmful content with the moderation prompt guard

In this configuration, agentgateway calls the Moderation API for each request and blocks the request itself when the content is flagged.

1. Create a configuration file and add the OpenAI moderation model that you want to use.

   > [!NOTE]
   > To run this guard without blocking traffic, set `openAIModeration.action: audit`. The guard records what it detects and forwards the content unchanged. For more information, see [Audit mode](../overview/#audit).

   ```yaml
   cat <<EOF > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         model: {{< reuse "agw-docs/snippets/openai-model.md" >}}
         apiKey: "$OPENAI_API_KEY"
       guardrails:
         request:
         - openAIModeration:
             model: omni-moderation-latest
             policies:
               backendAuth:
                 key: "$OPENAI_API_KEY"
           rejection:
             body: "Content blocked by moderation policy"
   EOF
   ```

2. Start the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

3. Send a request to the LLM that triggers the built-in guardrail. Verify that the request is blocked with a 403 response message. 
   ```sh
   curl -i http://localhost:4000/v1/chat/completions \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```

   Example output: 
   ```console
   HTTP/1.1 403 Forbidden
   content-length: 36

   Content blocked by moderation policy%    
   ```

## Moderate content inline on the OpenAI provider

In this configuration, agentgateway adds a `moderation` parameter to each request that it sends to OpenAI, and OpenAI moderates the content as part of the completion. No separate call to the Moderation API is made.

Because the gateway sets the parameter, a client cannot weaken the moderation that you configure. When a client sends its own `moderation` value, agentgateway replaces that value with yours.

> [!IMPORTANT]
> Inline moderation is configured on a backend, so it is available only in the `routes` configuration style. The `llm` configuration style has no `moderation` field, and agentgateway rejects a configuration file that adds one. For a comparison of the two styles, see [Configuration modes]({{< link-hextra path="/llm/configuration-modes/" >}}).

1. Create a configuration file that routes to OpenAI and sets the `moderation` field on the provider.
   ```yaml
   cat <<EOF > moderation-config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
       protocol: HTTP
   routes:
   - backends:
     - ai:
         name: openai
         provider:
           openAI:
             model: {{< reuse "agw-docs/snippets/openai-model.md" >}}
             moderation:
               model: omni-moderation-latest
               policy:
                 input:
                   mode: block
                 output:
                   mode: score
     policies:
       backendAuth:
         key: "$OPENAI_API_KEY"
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `moderation.model` | The moderation model that OpenAI uses. Omit to use `omni-moderation-latest`. |
   | `moderation.policy.input` | The policy for the content that the client sends. |
   | `moderation.policy.output` | The policy for the content that the model generates. |
   | `mode` | Either `block` or `score`. The value is passed to OpenAI, which decides how to act on it. The field is required in each policy that you include. |

   > [!WARNING]
   > Inline moderation reports on content. It does not stop the request at the gateway, and `block` does not currently stop it at OpenAI either. In testing against `gpt-4o-mini`, `gpt-4o`, `gpt-4.1`, and `gpt-5`, a request with flagged input returned the completion together with the moderation results, whether the mode was `block` or `score`. Treat inline moderation as a source of moderation signals, and use the moderation prompt guard when you need a request to be stopped.

2. Start the agentgateway.
   ```sh
   agentgateway -f moderation-config.yaml
   ```

3. Send a request to the LLM.
   ```sh
   curl -i http://localhost:3000/v1/chat/completions \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-3.5-turbo",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```

   OpenAI returns the completion with a `moderation` object that reports on the input and the output. The following example output is truncated.

   ```json
   {
     "choices": [
       {
         "message": {
           "role": "assistant",
           "content": "I'm really sorry to hear that you're feeling this way..."
         },
         "finish_reason": "stop"
       }
     ],
     "moderation": {
       "input": {
         "type": "moderation_results",
         "model": "omni-moderation-latest",
         "results": [
           {
             "flagged": true,
             "categories": {
               "self-harm": true,
               "self-harm/intent": true,
               "violence": true
             }
           }
         ]
       },
       "output": {
         "type": "moderation_results",
         "model": "omni-moderation-latest",
         "results": [
           {
             "flagged": false
           }
         ]
       }
     }
   }
   ```

### Requirements and limitations

Inline moderation applies only where agentgateway builds the request that it sends to OpenAI. The following conditions apply.

* **The provider must be OpenAI.** The `moderation` field exists only on the `openAI` provider. Azure OpenAI is a separate provider and has no such field. To moderate traffic to any other provider, use the moderation prompt guard instead.
* **The route type must be `completions` or `responses`.** Requests on a `passthrough` or `detect` route reach OpenAI unchanged, so the moderation parameter is not added.
* **Clients keep their own `moderation` value when you omit the field.** If you do not configure `moderation`, a `moderation` value that a client sends passes through to OpenAI unchanged. OpenAI requires `moderation.model`, so a client value that omits it fails with `Missing required parameter: 'moderation.model'`. Configuring `moderation` on the backend avoids this, because agentgateway always sends a model.
* **Moderation results reach the client only in OpenAI response formats.** A client that uses a different API format, such as the Anthropic Messages API, does not receive the moderation results.
