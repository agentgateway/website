Configure global or provider-specific aliases for your models to refer to your model by using user-friendly names. 

## Before you begin

{{< reuse "agw-docs/snippets/agw-prereq-llm.md" >}}

## Set up aliases

1. Update your {{< reuse "agw-docs/snippets/backend.md" >}} to add global model aliases. The following example adds two aliases, `fast` and `smart`. Each alias points to a specific model. Note that the example does not specify a default model. 

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: agentgateway.dev/v1alpha1
   kind: {{< reuse "agw-docs/snippets/backend.md" >}} 
   metadata:
     name: openai
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}} 
   spec:
     ai:
       provider:
         openai: {}
     policies:
       auth:
         secretRef:
           name: openai-secret
       ai: 
         modelAliases: 
           fast: gpt-3.5-turbo
           smart: gpt-4-turbo      
   EOF
   ```

2. Send a request to the OpenAI provider with the `fast` model. Verify that the request succeeds and that you also see the `gpt-3.5-turbo` model in your response. 

   {{< tabs tabTotal="2" items="OpenAI v1/chat/completions, Custom route" >}}
{{% tab tabName="OpenAI v1/chat/completions" %}}
**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json  -d '{
   "model": "fast",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```

**Localhost**:
```sh
curl "localhost:8080/v1/chat/completions" -H content-type:application/json  -d '{
   "model": "fast",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```
{{% /tab %}}
{{% tab tabName="Custom route" %}}
**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json  -d '{
   "model": "fast",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```

**Localhost**:
```sh
curl "localhost:8080/openai" -H content-type:application/json  -d '{
   "model": "fast",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```
{{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```console {hl_lines=[2]}
   {
     "model": "gpt-3.5-turbo-0125",
     "usage": {
       "prompt_tokens": 39,
   ...
   ```

3. Repeat the request to the OpenAI provider with the `smart` model. Verify that the request succeeds and that you also see the `gpt-4-turbo` model in your response. 

   {{< tabs tabTotal="2" items="OpenAI v1/chat/completions, Custom route" >}}
{{% tab tabName="OpenAI v1/chat/completions" %}}
**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/v1/chat/completions" -H content-type:application/json  -d '{
   "model": "smart",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```

**Localhost**:
```sh
curl "localhost:8080/v1/chat/completions" -H content-type:application/json  -d '{
   "model": "smart",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```
{{% /tab %}}
{{% tab tabName="Custom route" %}}
**Cloud Provider LoadBalancer**:
```sh
curl "$INGRESS_GW_ADDRESS/openai" -H content-type:application/json  -d '{
   "model": "smart",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```

**Localhost**:
```sh
curl "localhost:8080/openai" -H content-type:application/json  -d '{
   "model": "smart",
   "messages": [
     {
       "role": "system",
       "content": "You are a poetic assistant, skilled in explaining complex programming concepts with creative flair."
     },
     {
       "role": "user",
       "content": "Compose a poem that explains the concept of recursion in programming."
     }
   ]
 }' | jq
```
{{% /tab %}}
   {{< /tabs >}}

   Example output: 
   ```console {hl_lines=[2]}
   {
     "model": "gpt-4-turbo-2024-04-09",
     "usage": {
       "prompt_tokens": 39,
   ...
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} openai -n {{< reuse "agw-docs/snippets/namespace.md" >}} 