---
title: Regex filters
weight: 10
description: Match and redact prompt content with custom regex patterns or agentgateway's built-in PII detectors.
---

Use custom regex patterns and built-in PII detectors to filter LLM requests and responses.

## About regex prompt templating

Regex-based prompt guards let you inspect LLM requests and responses against custom regex patterns or built-in PII detectors. Use the `reject` action to block requests that match a pattern, or the `mask` action to redact sensitive data in responses before they reach the client.

### Built-in prompt guard patterns {#built-in-patterns}

Agentgateway includes the following built-in patterns for common PII types that you can reference in your prompt guards. 

| Pattern | Description |
| -- | -- |
| `email` | Email addresses |
| `phoneNumber` | Phone numbers |
| `ssn` | Social Security Numbers |
| `creditCard` | Credit card numbers that pass the Luhn checksum. Digit groups can be separated by spaces or hyphens. The checksum runs before the guard action, so a number that fails it is not masked, rejected, or audited. |
| `caSin` | Canadian Social Insurance Numbers |

### Custom regex patterns

Use custom patterns to match credentials, secrets, or application-specific sensitive data.

```yaml
llm:
  models:
  - name: "*"
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
    guardrails:
      request:
      - regex:
          action: reject
          rules:
          - pattern: "password[=:]\\s*\\S+"
          - pattern: "api[_-]?key[=:]\\s*\\S+"
          - pattern: "secret[=:]\\s*\\S+"
        rejection:
          status: 400
          headers:
            set:
              content-type: "application/json"
          body: |
            {
              "error": {
                "message": "Request contains credentials",
                "type": "invalid_request_error",
                "code": "credentials_detected"
              }
            }
```

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## PII detection

The following example rejects requests that contain PII data, such as Social Security Numbers (using a custom keyword pattern) or email addresses (using the built-in `email` pattern). When a request is blocked, agentgateway returns a custom error response.

1. Create a configuration file with regex prompt guard policies.
   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
       guardrails:
         request:
         - regex:
             action: reject
             rules:
             - pattern: SSN
             - pattern: Social Security
           rejection:
             status: 400
             headers:
               set:
                 content-type: "application/json"
             body: |
               {
                 "error": {
                   "message": "Request rejected: Content contains sensitive information",
                   "type": "invalid_request_error",
                   "code": "content_policy_violation"
                 }
               }
         - regex:
             action: reject
             rules:
             - builtin: email
           rejection:
             status: 400
             headers:
               set:
                 content-type: "application/json"
             body: |
               {
                 "error": {
                   "message": "Request blocked: Contains email address",
                   "type": "invalid_request_error",
                   "code": "pii_detected"
                 }
               }
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `regex.action` | The action to take when a pattern matches. Use `mask` to redact matched content, `reject` to block the request, or `audit` to record the match and forward the content unchanged. Defaults to `mask`. For more information about `audit`, see [Audit mode](../overview/#audit). |
   | `regex.rules` | List of patterns to match against. |
   | `pattern` | A custom regex pattern. |
   | `builtin` | A built-in PII pattern. See [Built-in patterns](#built-in-patterns) for available options. |
   | `rejection` | Custom response returned when a request is blocked. Specify an HTTP `status` code, response `headers`, and a `body`. |

2. Start the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

3. In a new terminal, send a request to your LLM provider. Verify that the request succeeds. 
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "Hello, how are you?"}]
     }'
   ```

   Example output: 
   ```console
   :0},"prompt_tokens_details":{"cached_tokens":0,
   "audio_tokens":0}},"choices":[{"message":
   {"content":"Hello! I'm just a program, but I'm here and 
   ready to help you. How can I assist you today?",
   "role":"assistant","refusal":null,"annotations":[]},
   "index":0,"logprobs":null,"finish_reason":"stop"}],
   "id":"chatcmpl-DHwlvtADPu5ZFznynSpmSjXL4B6W3",
   "object":"chat.completion",
   "service_tier":"default",
   "system_fingerprint":"fp_a1ddba3226"}
   ```

4. Send a request containing the SSN keyword. The prompt guard blocks the request and returns your custom error response.
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "My SSN is 123-45-6789"}]
     }'
   ```

   Example output:
   ```console
   {
     "error": {
       "message": "Request rejected: Content contains sensitive information",
       "type": "invalid_request_error",
       "code": "content_policy_violation"
     }
   }
   ```

5. Send another request with an email address. The prompt guard blocks it by using the built-in `email` pattern.
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "Contact me at test@example.com"}]
     }'
   ```

   Example output:
   ```console
   {
     "error": {
       "message": "Request blocked: Contains email address",
       "type": "invalid_request_error",
       "code": "pii_detected"
     }
   }
   ```

## Mask PII in responses

You can also filter LLM responses to redact sensitive data before it reaches the client. When a match is found, agentgateway replaces built-in pattern matches with `<ENTITY_TYPE>` (for example, `<CREDIT_CARD>`) and custom pattern matches with `<masked>`. The following example masks credit card numbers in responses.

> [!WARNING]
> Masking applies only to a buffered response. When the client sets `"stream": true`, the LLM response is streamed, and agentgateway cannot rewrite content that is already on its way to the client. A response guard that uses `action: mask` passes the matched content through unmodified, and the client receives no error. To protect a streamed response, use `action: reject` and set `streaming: Enabled`. For more information, see [Streaming guardrails]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#streaming-guardrails" >}}).

1. Create a configuration that masks phone numbers in LLM responses by using the built-in `phoneNumber` pattern.
   ```yaml
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
       guardrails:
         response:
         - regex:
             action: mask
             rules:
             - builtin: phoneNumber
   EOF
   ```

2. Start the agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

3. In a new terminal, send a request to your LLM provider with a phone number and verify that the number is masked in your response. 
   ```sh
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-4o-mini",
       "messages": [{"role": "user", "content": "What number is 919 222 1111?"}]
     }'
   ```

   Example output:
   ```console {hl_lines=[8]}
   {"model":"gpt-4o-mini-2024-07-18","usage":
   {"prompt_tokens":18,"completion_tokens":57,
   "total_tokens":75,"completion_tokens_details":
   {"reasoning_tokens":0,"audio_tokens":0,
   "accepted_prediction_tokens":0,
   "rejected_prediction_tokens":0},"prompt_tokens_details":
   {"cached_tokens":0,"audio_tokens":0}},"choices":
   [{"message":{"content":"The number <PHONE_NUMBER>appears 
   to be a phone number in the United States. The area code
   919 serves parts of North Carolina, including cities 
   like Raleigh and Durham. If you have a specific 
   question or need more information regarding this 
   number, please let me know!","role":"assistant",
   "refusal":null,"annotations":[]},"index":0,
   "logprobs":null,"finish_reason":"stop"}],
   "id":"chatcmpl-DHxEv3O5VOQPCmIVPruRiToal0rIe","object":"chat.completion","created":1773171665,
   "service_tier":"default",
   "system_fingerprint":"fp_a1ddba3226"}%    
   ```

## Scan tool call arguments {#scope}

By default, a request guard reads the system prompt, regular message text, and tool call results. Tool call arguments are not scanned. The following example adds `toolInput` to `scope` so that the guard also rejects PII in tool call arguments.

For what each scope value covers and the limits on the field, see [Guard scope]({{< link-hextra path="/documentation/llm/prompt-guards/overview/#scope" >}}).

1. Create a configuration that rejects a request when the system prompt, messages, tool call results, or tool call arguments contain a Social Security number.
   ```yaml
   cat <<'EOF' > config-scope.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   llm:
     models:
     - name: "*"
       provider: openAI
       params:
         model: gpt-4o-mini
         apiKey: "$OPENAI_API_KEY"
       guardrails:
         request:
         - scope: [systemPrompt, messages, toolOutput, toolInput]
           regex:
             action: reject
             rules:
             - builtin: ssn
           rejection:
             status: 400
             body: |
               {"error": {"message": "Request contains PII", "code": "pii_detected"}}
   EOF
   ```

   > [!NOTE]
   > Setting `scope` replaces the default. To keep the default content and add tool call arguments, list all four values. Use `reject` rather than `mask` for `toolInput`, because masking tool call arguments can produce invalid JSON.

2. Start the agentgateway with the new configuration.
   ```sh
   agentgateway -f config-scope.yaml
   ```

3. Send a request whose tool call arguments contain a Social Security number. The guard rejects it before the request reaches the provider.
   ```sh
   curl -s http://localhost:4000/v1/chat/completions \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "gpt-4o-mini",
     "messages": [
       {"role": "user", "content": "look up my record"},
       {"role": "assistant", "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "lookup", "arguments": "{\"ssn\": \"123-45-6789\"}"}}]},
       {"role": "tool", "tool_call_id": "c1", "content": "record found"}
     ]
   }' | jq .
   ```

   Example output:
   ```console
   {"error": {"message": "Request contains PII", "code": "pii_detected"}}
   ```
