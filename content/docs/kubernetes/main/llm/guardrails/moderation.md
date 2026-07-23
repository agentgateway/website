---
title: OpenAI moderation
weight: 15
description: Detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence with the OpenAI moderation API.
---

The OpenAI Moderation API detects potentially harmful content across categories including hate, harassment, self-harm, sexual content, and violence.

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

### Block harmful content

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

## Backend connection and authentication policies

The `policies` field configures how agentgateway connects and authenticates to the OpenAI Moderation API when it evaluates a request.

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