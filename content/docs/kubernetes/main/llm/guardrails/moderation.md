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
   apiVersion: {{< reuse "agw-docs/snippets/trafficpolicy-apiversion.md" >}}
   kind: {{< reuse "agw-docs/snippets/trafficpolicy.md" >}}
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
   {{< tabs tabTotal="2" items="Cloud Provider LoadBalancer,Port-forward for local testing" >}}

   {{% tab tabName="Cloud Provider LoadBalancer" %}}
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

   {{% tab tabName="Port-forward for local testing" %}}
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

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/trafficpolicy.md" >}} openai-prompt-guard -n {{< reuse "agw-docs/snippets/namespace.md" >}} 
```