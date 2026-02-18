---
title: Control spend
weight: 50
description: Limit the number of tokens that can be used to prevent unexpected bills and LLM misuse. 
---

Limit the number of tokens that can be used to prevent unexpected bills and LLM misuse. 

## About LLM spending

LLMs typically charge per input and output token, and not per query. Because of that, even smaller queries can become expensive quickly, especially if prompts are long, context windows are large, or outputs are very verbose. Without spending control, users can quickly generate large bills by submitting long prompts, streaming or retrying requests, or running recursive agent loops. Attackers can also craft prompt bombs or denial-of-wallet attacks that force the system to consume massive amounts of tokens at your expense. 

To protect against unexpected bills, scaling surprises, and abuse, it is essential to limit the number of tokens that can be used. 

## Rate limiting in agentgateway

Agentgateway comes with built-in rate limiting capabilities to limit the number of tokens that can be used. Each token (prompt or completion) consumes 1 unit of capacity. Because the number of tokens that are used for the completion is not known at the time the request is sent, calculating the number of tokens can become tricky. To work around this issue, agentgateway checks token-based rate limits in two phases: 

### At request time

{{< reuse "agw-docs/snippets/ratelimit-requesttime.md" >}} 

### At response time

{{< reuse "agw-docs/snippets/ratelimit-responsetime.md" >}} 

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## Configure the agentgateway

1. Create a configuration file with your token-based local rate limiting settings. The following example uses the OpenAI provider, but you can adjust this example to use the provider of your choice. For an overview of supported providers, see [Providers](../providers).
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
                 # Optional; overrides the model in requests
                 model: gpt-3.5-turbo
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
           localRateLimit:
             - maxTokens: 10
               tokensPerFill: 1
               fillInterval: 60s
               type: tokens
           cors:
             allowOrigins:
               - "*"
             allowHeaders:
               - "*"
   EOF
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}}

   | Setting | Description | 
   | -- | -- | 
   | `maxTokens` | The maximum number of tokens that are available to use. | 
   | `tokensPerFill` | The number of tokens that are added during a refill. |  
   | `fillInterval` | The number of seconds after which the token bucket is refilled. | 
   | `type` | The type of rate limiting that you want to apply. In this example, you want to perform token-based rate limiting. However, you can also change this value to `requests` if you want to rate limit based on the number of requests. | 

2. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```
   
## Verify rate limits

1. Send a prompt to the LLM that instructs the LLM to tell a short story. At the time the prompt is sent, the number of tokens that are required for the completion is unknown. Because `tokenize: true` is not set in your agentgateway proxy, the prompt count is not estimated. As a result, the prompt is allowed, because the number of tokens is unknown and cannot be counted against the rate limit. 

   {{< callout type="info">}}
   The LLM typically returns the number of tokens that were required for completion in its response. Agentgateway uses this number and counts it against the rate limit. 
   {{< /callout >}}
   
   ```sh
   curl 'http://0.0.0.0:3000/' \
   --header 'Content-Type: application/json' \
   --data ' {
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }'
   ```
   
   Example output: 
   ```
   {"id":"chatcmpl-CBms1tAAgkoreamvAmgpr","choices":[{"index":0,"message":{"content":"Once upon a time, 
   in a small village nestled between towering mountains and lush forests, there lived a young girl named
   Lily....","role":"assistant"},"finish_reason":"stop"}],"created":1756925501,"model":"gpt-3.5-turbo-0125",
   "service_tier":"default","object":"chat.completion","usage":{"prompt_tokens":12,"completion_tokens":248,
   "total_tokens":260,"prompt_tokens_details":{"audio_tokens":0,"cached_tokens":0},
   "completion_tokens_details":{"accepted_prediction_tokens":0,"audio_tokens":0,"reasoning_tokens":0,
   "rejected_prediction_tokens":0}}}%        
   ```
   
2. Repeat the same request. Note that this time, the request is rate limited, because the number of tokens that were returned from the first request and response exceeded the number of tokens in your rate limiting setting. 
   ```sh
   curl 'http://0.0.0.0:3000/' \
   --header 'Content-Type: application/json' \
   --data ' {
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }'
   ```
   
   Example output: 
   ```
   rate limit exceeded
   ```
   
3. Change your agentgateway rate limiting configuration to include the `tokenize: true` setting in your LLM provider. This setting allows agentgateway to estimate the number of tokens that are required for completion. 
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
                 # Optional; overrides the model in requests
                 model: gpt-3.5-turbo
             tokenize: true
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
           localRateLimit:
             - maxTokens: 10
               tokensPerFill: 1
               fillInterval: 60s
               type: tokens
           cors:
             allowOrigins:
               - "*"
             allowHeaders:
               - "*"
   EOF
   ```

4. Run the agentgateway. 
   ```sh
   agentgateway -f config.yaml
   ```

5. Try the same request again. This time, the request is denied immediately, because the number of tokens that are used for the prompt and user role exceeds the maximum of 10 tokens available.
   ```sh
   curl 'http://0.0.0.0:3000/' \
   --header 'Content-Type: application/json' \
   --data ' {
     "model": "gpt-3.5-turbo",
     "messages": [
       {
         "role": "user",
         "content": "Tell me a short story"
       }
     ]
   }'
   ```
   
   Example output: 
   ```
   rate limit exceeded
   ```

   
   


