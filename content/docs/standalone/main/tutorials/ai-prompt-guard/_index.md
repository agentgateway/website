---
title: AI Prompt Guard
weight: 9
description: Protect LLM requests from prompt injection and sensitive data exposure
---

Agent Gateway can inspect and filter LLM requests to prevent prompt injection attacks and block sensitive data like PII from being sent to AI models.

## What you'll build

In this tutorial, you'll:
1. Configure prompt guard policies for LLM requests
2. Block sensitive data like SSNs and email addresses from reaching the LLM
3. Use both custom regex patterns and built-in patterns for filtering
4. Test the prompt guard to see requests blocked in real-time

## Prerequisites

- [Agent Gateway installed]({{< link-hextra path="/quickstart/" >}})
- An OpenAI API key (get one at [platform.openai.com](https://platform.openai.com/api-keys))

## Step 1: Set up your environment

Create a working directory and set your API key:

```bash
mkdir prompt-guard-test && cd prompt-guard-test
export OPENAI_API_KEY=your-api-key-here
```

## Step 2: Create the configuration

Create a `config.yaml` file with prompt guard policies:

```bash
cat > config.yaml << 'EOF'
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
        ai:
          promptGuard:
            request:
            # Block Social Security Numbers
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
            # Block email addresses
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
        backendAuth:
          key: "$OPENAI_API_KEY"
EOF
```

### Configuration explained

| Setting | Description |
|---------|-------------|
| `policies.ai.promptGuard` | The prompt guard policy that inspects LLM requests |
| `request` | Rules applied to incoming requests before they reach the LLM |
| `regex.action: reject` | Block requests that match the patterns |
| `regex.rules` | List of patterns to match against |
| `pattern` | Custom regex pattern to match |
| `builtin` | Use a built-in pattern (like `email`) |
| `rejection` | Custom response returned when a request is blocked |

## Step 3: Start Agent Gateway

```bash
agentgateway -f config.yaml
```

You should see output indicating the gateway is running on port 3000.

## Step 4: Test normal requests

In a new terminal, send a normal request:

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

You should receive a normal response from the LLM.

## Step 5: Test blocked requests

### Block SSN mentions

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "My SSN is 123-45-6789"}]
  }'
```

**Expected response** (request blocked by prompt guard):
```json
{
  "error": {
    "message": "Request rejected: Content contains sensitive information",
    "type": "invalid_request_error",
    "code": "content_policy_violation"
  }
}
```

### Block email addresses

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Contact me at test@example.com"}]
  }'
```

**Expected response** (request blocked by prompt guard):
```json
{
  "error": {
    "message": "Request blocked: Contains email address",
    "type": "invalid_request_error",
    "code": "pii_detected"
  }
}
```

## Built-in patterns

Agent Gateway includes built-in patterns for common PII types:

| Pattern | Description |
|---------|-------------|
| `email` | Email addresses |
| `phone` | Phone numbers |
| `ssn` | Social Security Numbers |
| `credit_card` | Credit card numbers |
| `ip_address` | IP addresses |

Example using built-in SSN pattern:
```yaml
- regex:
    action: reject
    rules:
    - builtin: ssn
```

## Custom regex patterns

Add your own regex patterns to catch credentials, secrets, or custom data:

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

## Response filtering

You can also filter LLM responses to mask sensitive data before it reaches the client:

```yaml
policies:
  ai:
    promptGuard:
      response:
      - regex:
          action: mask
          rules:
          - builtin: credit_card
          replacement: "[REDACTED]"
```

## Cleanup

Stop the Agent Gateway with `Ctrl+C` and remove the test directory:

```bash
cd .. && rm -rf prompt-guard-test
```

## Learn more

{{< cards >}}
  {{< card link="/docs/llm/" title="LLM Gateway" subtitle="LLM gateway features" >}}
  {{< card link="/docs/configuration/traffic-management/llm/" title="AI Policies" subtitle="AI policy configuration reference" >}}
{{< /cards >}}
