---
title: Regex filters
weight: 10
description: Match and redact prompt content with custom regex patterns or agentgateway's built-in PII detectors.
test:
  regex:
  - file: ${versionRoot}/llm/prompt-guards/regex.md
    path: regex
---

Use custom regex patterns and built-in PII detectors to filter LLM requests and responses.

{{< doc-test paths="regex" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * "Custom regex patterns": the credential-matching example config is accepted
#     by agentgateway (--validate-only), covering `guardrails.request[].regex`
#     with `action: reject`, `rules[].pattern`, and a `rejection` block that sets
#     a status, headers, and body.
#   * "PII detection" step 1: the config with both a custom-pattern rule and a
#     `builtin: email` rule is accepted.
#   * "PII detection" step 4: a request containing the SSN keyword is rejected
#     with the documented status (400) and the exact documented error body
#     (`content_policy_violation`). The `Social Security` pattern from the same
#     rule is checked too, which the page describes but does not demonstrate.
#   * "PII detection" step 5: a request containing an email address is rejected by
#     the built-in `email` pattern with the documented `pii_detected` body,
#     confirming the built-in patterns table is wired up and that the second
#     guardrail is evaluated independently of the first.
#   * "PII detection" step 3, partially: a prompt that matches no rule is NOT
#     blocked by the guard. The test asserts the response is not a guard rejection
#     rather than asserting success, so it holds whether or not a real API key is
#     present.
#   * "Mask PII in responses" step 1: the `action: mask` config with
#     `builtin: phoneNumber` is accepted.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * The successful completion in "PII detection" step 3 and its example output -
#     external dependency; a real response needs a live OpenAI key and bills a
#     completion. Only that the guard does not block the request is asserted.
#   * "Mask PII in responses" steps 2-3, including the `<PHONE_NUMBER>`
#     replacement - external dependency; masking operates on a real LLM response
#     body, so there is nothing to redact without a live provider call. The config
#     is validated but the mask behavior is not.
#   * The other built-in patterns (`phoneNumber`, `ssn`, `creditCard`, `caSin`) as
#     request filters - display-only table rows; only `email` appears in a runnable
#     example on this page.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example configs read the API key from the environment. Guard rejections
# happen before any upstream call, so a placeholder is enough for the assertions
# below; CI supplies a real key when one is available.
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
{{< /doc-test >}}

## About regex prompt templating

Regex-based prompt guards let you inspect LLM requests and responses against custom regex patterns or built-in PII detectors. Use the `reject` action to block requests that match a pattern, or the `mask` action to redact sensitive data in responses before they reach the client.

### Built-in prompt guard patterns {#built-in-patterns}

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

{{< doc-test paths="regex" >}}
cat <<'EOF' > config-custom.yaml
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
EOF
agentgateway -f config-custom.yaml --validate-only
{{< /doc-test >}}

## Before you begin

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

## PII detection

The following example rejects requests that contain PII data, such as Social Security Numbers (using a custom keyword pattern) or email addresses (using the built-in `email` pattern). When a request is blocked, agentgateway returns a custom error response.

1. Create a configuration file with regex prompt guard policies.
   ```yaml {paths="regex"}
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

{{< doc-test paths="regex" >}}
# Validate the config written by step 1, then run it in the background so the
# step 4 and step 5 requests can be asserted. The visible "Start the agentgateway"
# block is untagged because it runs in the foreground.
agentgateway -f config.yaml --validate-only

agentgateway -f config.yaml &
AGW_PID=$!
trap 'kill $AGW_PID 2>/dev/null' EXIT
sleep 3
{{< /doc-test >}}

{{< doc-test paths="regex" >}}
YAMLTest -f - <<'EOF'
# Guard rejections are produced by agentgateway before the request reaches the
# provider, so these assertions hold with a placeholder API key.
- name: Step 4 - a request containing the SSN keyword is rejected
  retries: 3
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      accept-encoding: identity
    body: |
      {"model":"gpt-4o-mini","messages":[{"role":"user","content":"My SSN is 123-45-6789"}]}
  source:
    type: local
  expect:
    statusCode: 400
    headers:
      - name: content-type
        comparator: contains
        value: application/json
    bodyJsonPath:
      - path: "$.error.code"
        comparator: equals
        value: content_policy_violation
      - path: "$.error.message"
        comparator: equals
        value: "Request rejected: Content contains sensitive information"
      - path: "$.error.type"
        comparator: equals
        value: invalid_request_error
- name: Step 4 rule - the Social Security pattern in the same rule also rejects
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      accept-encoding: identity
    body: |
      {"model":"gpt-4o-mini","messages":[{"role":"user","content":"my Social Security number"}]}
  source:
    type: local
  expect:
    statusCode: 400
    bodyJsonPath:
      - path: "$.error.code"
        comparator: equals
        value: content_policy_violation
- name: Step 5 - a request containing an email is rejected by the builtin pattern
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
      accept-encoding: identity
    body: |
      {"model":"gpt-4o-mini","messages":[{"role":"user","content":"Contact me at test@example.com"}]}
  source:
    type: local
  expect:
    statusCode: 400
    bodyJsonPath:
      - path: "$.error.code"
        comparator: equals
        value: pii_detected
      - path: "$.error.message"
        comparator: equals
        value: "Request blocked: Contains email address"
EOF
{{< /doc-test >}}

{{< doc-test paths="regex" >}}
# Step 3: confirm a prompt that matches no rule is not blocked by the guard. The
# assertion is negative rather than a 200 check, because without a real API key the
# upstream returns an auth error -- either way the guard must not have rejected it.
CLEAN=$(curl -s --max-time 15 http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hello, how are you?"}]}')
if grep -qE 'content_policy_violation|pii_detected' <<<"$CLEAN"; then
  echo "FAIL: a prompt matching no regex rule was blocked by the prompt guard"
  echo "$CLEAN"
  exit 1
fi
echo "✓ A prompt matching no regex rule was not blocked by the prompt guard"
{{< /doc-test >}}

## Mask PII in responses

You can also filter LLM responses to redact sensitive data before it reaches the client. When a match is found, agentgateway replaces built-in pattern matches with `<ENTITY_TYPE>` (for example, `<CREDIT_CARD>`) and custom pattern matches with `<masked>`. The following example masks credit card numbers in responses.

> [!WARNING]
> Masking applies only to a buffered response. When the client sets `"stream": true`, the LLM response is streamed, and agentgateway cannot rewrite content that is already on its way to the client. A response guard that uses `action: mask` passes the matched content through unmodified, and the client receives no error. To protect a streamed response, use `action: reject` and set `streaming: Enabled`. For more information, see [Streaming guardrails]({{< link-hextra path="/llm/prompt-guards/overview/#streaming-guardrails" >}}).

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


{{< doc-test paths="regex" >}}
# The mask config is written to its own file so it does not overwrite the config.yaml
# that the running gateway (and the assertions above) depend on.
cat <<'EOF' > config-mask.yaml
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
agentgateway -f config-mask.yaml --validate-only
{{< /doc-test >}}

## Scan tool call content {#scope}

By default, a request guard reads the system prompt and regular message text only. Tool call results that come back to the model are not read, so PII that a tool returns reaches the provider untouched. Set the `scope` field to include `toolOutput`.

For what each scope value covers and the limits on the field, see [Guard scope]({{< link-hextra path="/llm/prompt-guards/overview/#scope" >}}).

1. Create a configuration that rejects a request when a tool result contains a Social Security number.
   ```yaml {paths="regex"}
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
         - scope: [toolOutput]
           regex:
             action: reject
             rules:
             - builtin: ssn
           rejection:
             status: 400
             body: |
               {"error": {"message": "Tool output contains PII", "code": "pii_detected"}}
   EOF
   ```

   > [!WARNING]
   > This guard reads tool results and nothing else. Because `scope` replaces the default rather than adding to it, the same Social Security number in a user message is no longer caught. To cover both, use `scope: [messages, toolOutput]`.

2. Start the agentgateway with the new configuration.
   ```sh
   agentgateway -f config-scope.yaml
   ```

   {{< doc-test paths="regex" >}}
   # Guard scope: restart the gateway on config-scope.yaml. This comment keeps the
   # block textually distinct from the earlier restart block, because the extractor
   # drops a block whose content is byte-identical to one it already selected.
   agentgateway -f config-scope.yaml --validate-only
   kill $AGW_PID 2>/dev/null
   sleep 1
   agentgateway -f config-scope.yaml &
   AGW_PID=$!
   trap 'kill $AGW_PID 2>/dev/null' EXIT
   sleep 3
   {{< /doc-test >}}

3. Send a request whose tool result contains a Social Security number. The guard rejects it before the request reaches the provider.
   ```sh {paths="regex"}
   curl -s http://localhost:4000/v1/chat/completions \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "gpt-4o-mini",
     "messages": [
       {"role": "user", "content": "look up my record"},
       {"role": "assistant", "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}]},
       {"role": "tool", "tool_call_id": "c1", "content": "record found for 123-45-6789"}
     ]
   }' | jq .
   ```

   Example output:
   ```console
   {"error": {"message": "Tool output contains PII", "code": "pii_detected"}}
   ```

4. Send the same Social Security number in a user message instead. The guard does not read messages while `scope` is set to `toolOutput`, so the request is forwarded to the provider.
   ```sh {paths="regex"}
   curl -s http://localhost:4000/v1/chat/completions \
   --header 'Content-Type: application/json' \
   --data '{
     "model": "gpt-4o-mini",
     "messages": [{"role": "user", "content": "my ssn is 123-45-6789"}]
   }' | jq .
   ```

   The response comes from the provider rather than from the guard, which confirms that the guard let the request through.

{{< doc-test paths="regex" >}}
YAMLTest -f - <<'EOF'
# The rejection is produced by the guard before the provider is reached, so this
# assertion holds with the placeholder API key that the test workflow supplies.
- name: Guard scope - a Social Security number in a tool result is rejected
  retries: 3
  http:
    url: "http://localhost:4000"
    path: /v1/chat/completions
    method: POST
    headers:
      content-type: application/json
    body: |
      {"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "look up my record"}, {"role": "assistant", "tool_calls": [{"id": "c1", "type": "function", "function": {"name": "lookup", "arguments": "{}"}}]}, {"role": "tool", "tool_call_id": "c1", "content": "record found for 123-45-6789"}]}
  source:
    type: local
  expect:
    statusCode: 400
    bodyJsonPath:
      - path: "$.error.code"
        comparator: equals
        value: pii_detected
EOF
{{< /doc-test >}}

{{< doc-test paths="regex" >}}
# Step 4: confirm the guard does NOT read messages while scope is toolOutput. Like
# the step 3 check in "PII detection", this is a negative assertion rather than a
# status check: without a real API key the upstream returns an auth error, and
# either way what matters is that the guard did not reject the request.
SCOPED=$(curl -s --max-time 15 http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"my ssn is 123-45-6789"}]}')
if grep -q 'pii_detected' <<<"$SCOPED"; then
  echo "FAIL: the guard read a message although scope is limited to toolOutput"
  echo "$SCOPED"
  exit 1
fi
echo "✓ A scope of toolOutput leaves message text unread"
{{< /doc-test >}}
