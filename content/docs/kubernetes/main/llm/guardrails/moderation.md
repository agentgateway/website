---
title: OpenAI moderation
weight: 15
description: Detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence with the OpenAI moderation API.
---

The OpenAI Moderation API detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence.

## About the two moderation options

Two separate features use the OpenAI Moderation API, and they have similar names. This page covers both. Read the following table to choose the one that fits your use case.

| Area | Moderation prompt guard | Inline moderation |
| -- | -- | -- |
| Configuration field | `openAIModeration`, on an {{< reuse "agw-docs/snippets/policy.md" >}} | `moderation`, on the OpenAI provider of an {{< reuse "agw-docs/snippets/backend.md" >}} |
| What performs the check | agentgateway calls the Moderation API | OpenAI moderates as part of the completion request |
| Extra call to OpenAI per request | Yes | No |
| Supported providers | Any provider that the policy targets | OpenAI only |
| Result when content is flagged | agentgateway returns a 403 response with the message that you configure | OpenAI returns the completion with moderation results attached |
| Stops the request | Yes | No |

The two features are independent, and enabling one does not change the other. You can configure both at the same time, and combining them is the way to get both a hard block and per-category moderation scores.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Block harmful content with the moderation prompt guard

In this configuration, agentgateway calls the Moderation API for each request and blocks the request itself when the content is flagged.

1. Configure the prompt guard to use OpenAI Moderation:
   ```yaml
   kubectl apply -f - <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: openai-prompt-guard
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: openai
     backend:
       ai:
         promptGuard:
           request:
           - openAIModeration:
               policies:
                 auth:
                   secretRef:
                     name: openai-secret
               model: omni-moderation-latest
             response:
               message: "Content blocked by moderation policy"
   EOF
   ```

   The `policies` field supports more than the `secretRef` authentication shown here. You can choose a different authentication method or tune the connection that agentgateway opens to the Moderation API, such as setting a request timeout or custom TLS. For all the options, see [Backend connection and authentication policies](#backend-connection-and-authentication-policies).

2. Test with content that triggers moderation. 
   {{< tabs >}}

   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "$INGRESS_GW_ADDRESS/openai" \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```
   {{% /tab %}}

   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i "localhost:8080/openai" \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```
   {{% /tab %}}

   {{< /tabs >}}

   Expected response:
   ```
   HTTP/1.1 403 Forbidden
   Content blocked by moderation policy
   ```

## Moderate content inline on the OpenAI provider

In this configuration, agentgateway adds a `moderation` parameter to each request that it sends to OpenAI, and OpenAI moderates the content as part of the completion. No separate call to the Moderation API is made.

Because the gateway sets the parameter, a client cannot weaken the moderation that you configure. When a client sends its own `moderation` value, agentgateway replaces that value with yours.

1. Update the {{< reuse "agw-docs/snippets/backend.md" >}} resource for your OpenAI provider to add the `moderation` field:
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         openai:
           model: {{< reuse "agw-docs/snippets/openai-model.md" >}}
           moderation:
             model: omni-moderation-latest
             policy:
               input:
                 mode: Block
               output:
                 mode: Score
     policies:
       auth:
         secretRef:
           name: openai-secret
       ai:
         routes:
           "/v1/chat/completions": "Completions"
           "/v1/responses": "Responses"
   EOF
   ```

   {{% reuse "agw-docs/snippets/review-table.md" %}}

   | Setting | Description |
   | -- | -- |
   | `moderation.model` | The moderation model that OpenAI uses. Omit to use `omni-moderation-latest`. |
   | `moderation.policy.input` | The policy for the content that the client sends. |
   | `moderation.policy.output` | The policy for the content that the model generates. |
   | `mode` | Either `Block` or `Score`. The value is passed to OpenAI, which decides how to act on it. The field is required in each policy that you include. |

   > [!WARNING]
   > Inline moderation reports on content. It does not stop the request at the gateway, and `Block` does not currently stop it at OpenAI either. In testing against `gpt-4o-mini`, `gpt-4o`, `gpt-4.1`, and `gpt-5`, a request with flagged input returned the completion together with the moderation results, whether the mode was `Block` or `Score`. Treat inline moderation as a source of moderation signals, and use the moderation prompt guard when you need a request to be stopped.

2. Send a request to the LLM provider. 
   {{< tabs >}}

   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i "$INGRESS_GW_ADDRESS/openai" \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```
   {{% /tab %}}

   {{% tab name="Port-forward for local testing" %}}
   ```sh
   curl -i "localhost:8080/openai" \
     -H "content-type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [
         {
           "role": "user",
           "content": "I want to harm myself"
         }
       ]
     }'
   ```
   {{% /tab %}}

   {{< /tabs >}}

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

* **The provider must be OpenAI.** The `moderation` field exists only on the `openai` provider. Azure OpenAI is a separate provider and has no such field. To moderate traffic to any other provider, use the moderation prompt guard instead.
* **The route type must be `Completions` or `Responses`.** Requests on a `Passthrough` or `Detect` route reach OpenAI unchanged, so the moderation parameter is not added. The [OpenAI provider guide]({{< link-hextra path="/llm/providers/openai/" >}}) sets `"*": "Passthrough"` as a catch-all, so give the chat completions and responses paths an explicit route type, as shown in the preceding example.
* **Clients keep their own `moderation` value when you omit the field.** If you do not configure `moderation`, a `moderation` value that a client sends passes through to OpenAI unchanged. OpenAI requires `moderation.model`, so a client value that omits it fails with `Missing required parameter: 'moderation.model'`. Configuring `moderation` on the backend avoids this, because agentgateway always sends a model.
* **Moderation results reach the client only in OpenAI response formats.** A client that uses a different API format, such as the Anthropic Messages API, does not receive the moderation results.

> [!NOTE]
> The mode values are `Block` and `Score` in Kubernetes mode. The standalone mode documentation uses `block` and `score` in lowercase for the same fields.

## Backend connection and authentication policies

The `policies` field configures how agentgateway connects and authenticates to the OpenAI Moderation API when it evaluates a request. These settings apply to the moderation prompt guard. Inline moderation reuses the connection to the OpenAI provider, so it needs no separate connection settings.

### Authentication

Under `policies.auth`, set one credential source (`secretRef` or `key`). Optionally, set `location` to control where the credential is placed.

| Method | Description |
| -- | -- |
| `secretRef` | Read the API key from a Kubernetes secret. By default, the key that matches the credential location is used, such as `Authorization` for the default header location. To use a different key, set `secretRef.key`. |
| `key` | Send an inline API key in the `Authorization` header. This option is the least secure. Use a secret instead when possible. |
| `location` | Where to place the credential. Defaults to the `Authorization` header with a `Bearer` prefix. To change it, set a `header`, `queryParameter`, or `cookie`. |

### Backend connection settings

You can also tune the connection that agentgateway opens to the OpenAI Moderation backend by setting the following `BackendConnectionPolicy` fields under `policies`.

| Setting | Description |
| -- | -- |
| `tls` | TLS settings for the connection, such as a custom CA certificate or SNI. |
| `http` | HTTP settings, such as the `requestTimeout` and HTTP protocol `version`. |
| `tcp` | TCP connection settings. |
| `tunnel` | Tunnel settings, such as an `HTTPS_PROXY`, used to reach the backend. |

For example, the following prompt guard authenticates with a secret and sets a request timeout for the calls to the Moderation API.

```yaml
- openAIModeration:
    model: omni-moderation-latest
    policies:
      auth:
        secretRef:
          name: openai-secret
      http:
        requestTimeout: 5s
```

For the full set of fields, see the [API reference]({{< link-hextra path="/reference/api/" >}}).

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} openai-prompt-guard -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```

To remove inline moderation, remove the `moderation` field from the {{< reuse "agw-docs/snippets/backend.md" >}} resource and reapply it.
