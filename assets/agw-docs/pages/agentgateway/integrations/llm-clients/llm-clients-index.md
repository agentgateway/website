# LLM Client Configuration

Configure AI coding tools and applications to use agentgateway as their LLM backend.

## Overview

agentgateway exposes an OpenAI-compatible API (`/v1/chat/completions`) that works seamlessly with any tool or SDK designed for OpenAI. This allows you to:

- Route requests through agentgateway's policies (auth, rate limiting, observability)
- Use any configured backend provider (OpenAI, Anthropic, Bedrock, Vertex, etc.) transparently
- Switch providers without changing client code
- Apply consistent governance across all LLM consumption

## Quick start

All clients require three pieces of information:

1. **Base URL**: Your agentgateway address with `/v1` path
   - Example: `http://localhost:3000/v1` or `https://gateway.example.com/v1`

2. **API Key**: Depends on your gateway configuration:
   - If using `backendAuth` policy: the key is passed through to your LLM provider
   - If using gateway authentication: your gateway-specific API key
   - If no auth configured: any placeholder value (e.g., `"anything"`)

3. **Model**: The model name configured in your backend, or override per-request

## Supported clients

{{< cards >}}
  {{< card link="cursor" title="Cursor" subtitle="AI code editor with custom model support" >}}
  {{< card link="continue" title="VS Code Continue" subtitle="Open source AI code assistant" >}}
  {{< card link="openai-sdk" title="OpenAI SDK" subtitle="Python and Node.js SDKs" >}}
  {{< card link="curl" title="curl" subtitle="Command-line testing" >}}
{{< /cards >}}

## Example gateway configuration

Here's a minimal agentgateway configuration that accepts requests on port 3000 and routes to OpenAI:

```yaml
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
```

With this configuration, clients can connect to `http://localhost:3000/v1` using any OpenAI-compatible SDK or tool.

## Environment variables

Many AI coding tools support environment variables for configuration:

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_BASE_URL` | Base URL for OpenAI-compatible API | `http://localhost:3000/v1` |
| `OPENAI_API_KEY` | API key (placeholder if no auth) | `anything` |
| `OPENAI_API_BASE` | Alternative name for base URL | `http://localhost:3000/v1` |

Check each client's documentation for supported environment variables.
