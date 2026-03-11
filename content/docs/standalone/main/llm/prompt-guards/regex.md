---
title: Regex filters
weight: 10
description: Use custom regex patterns and built-in PII detectors to filter LLM requests and responses.
---

Use custom regex patterns and built-in PII detectors to filter LLM requests and responses.

## About regex prompt templating

Regex-based prompt guards let you inspect LLM requests and responses against custom regex patterns or built-in PII detectors. Use the `reject` action to block requests that match a pattern, or the `mask` action to redact sensitive data in responses before they reach the client.

### Built-in prompt guard patterns

Agentgateway includes the following built-in patterns for common PII types that you can reference in your prompt guards. 

| Pattern | Description |
| -- | -- |
| `email` | Email addresses |
| `phoneNumber` | Phone numbers |
| `ssn` | Social Security Numbers |
| `creditCard` | Credit card numbers |
| `caSin` | Canadian Social Insurance Numbers |

### Custom regex patterns

Use custom patterns to match credentials, secrets, or application-specific sensitive data.

```yaml
policies:
  ai:
    promptGuard:
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

## Reject requests

The following example rejects requests that contain Social Security Numbers (using a custom keyword pattern) or email addresses (using the built-in `email` pattern). When a request is blocked, agentgateway returns a custom error response.

1. Create a configuration file with regex prompt guard policies.
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
                 model: gpt-4o-mini
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
           ai:
             promptGuard:
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
   | `regex.action` | The action to take when a pattern matches. Use `reject` to block the request or `mask` to redact matched content. |
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
   curl http://localhost:3000/v1/chat/completions \
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
   curl http://localhost:3000/v1/chat/completions \
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
   curl http://localhost:3000/v1/chat/completions \
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

## Mask responses

You can also filter LLM responses to redact sensitive data before it reaches the client. When a match is found, agentgateway replaces built-in pattern matches with `<ENTITY_TYPE>` (for example, `<CREDIT_CARD>`) and custom pattern matches with `<masked>`. The following example masks credit card numbers in responses.

1. Create a configuration that masks phone numbers in LLM responses by using the built-in `phoneNumber` pattern.
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
                 model: gpt-4o-mini
         policies:
           backendAuth:
             key: "$OPENAI_API_KEY"
           ai:
             promptGuard:
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
   curl http://localhost:3000/v1/chat/completions \
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


