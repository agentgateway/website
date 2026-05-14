---
title: Chatbot UI
description: Front Chatbot UI with agentgateway to keep API keys server-side and audit every chat.
---

[Chatbot UI](https://github.com/mckaywrigley/chatbot-ui) is an open-source ChatGPT-style interface by Mckay Wrigley. Because it speaks the OpenAI Chat Completions API, you can point it at agentgateway instead of directly at OpenAI to centralize credentials, apply policies, and capture audit logs.

## What you get

- Browser users no longer hold the OpenAI API key — agentgateway does.
- A consistent place to apply [rate limits]({{< link-hextra path="/llm/spending/" >}}) and capture [observability data]({{< link-hextra path="/llm/observability/" >}}).
- The same gateway can later front additional providers without changing Chatbot UI.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Chatbot UI    │────▶│   agentgateway  │────▶│     OpenAI      │
│   (port 3000)   │     │   (port 3001)   │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).
2. Get an API key for your LLM provider (e.g. [OpenAI](https://platform.openai.com/api-keys)).
3. Clone or run [Chatbot UI](https://github.com/mckaywrigley/chatbot-ui). Note that recent versions of Chatbot UI require a Supabase backend; see the upstream README for the full setup.

## Steps

{{% steps %}}

### Step 1: Configure agentgateway

Create a `config.yaml`. Agentgateway listens on port `3001` so it does not conflict with Chatbot UI's default port `3000`:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  port: 3001
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

### Step 2: Start agentgateway

```sh
export OPENAI_API_KEY='<your-api-key>'
agentgateway -f config.yaml
```

### Step 3: Point Chatbot UI at agentgateway

Set Chatbot UI's environment variables in its `.env.local` so that requests target the gateway instead of OpenAI directly.

```sh
OPENAI_API_HOST=http://localhost:3001
OPENAI_API_KEY=placeholder
```

`OPENAI_API_KEY` must be non-empty for Chatbot UI to start, but it is not used to call OpenAI — agentgateway holds the real key.

{{< callout type="info" >}}
If you run Chatbot UI via Docker, replace `localhost` with `host.docker.internal` so the container can reach agentgateway on your host machine:

```sh
docker run --rm -p 3000:3000 \
  -e OPENAI_API_KEY=placeholder \
  -e OPENAI_API_HOST=http://host.docker.internal:3001 \
  ghcr.io/mckaywrigley/chatbot-ui:main
```
{{< /callout >}}

If you are running a Supabase-backed build of Chatbot UI, the equivalent variable is the OpenAI base URL field in the user **Settings** screen; set it to `http://localhost:3001/v1`.

### Step 4: Send a message

Open `http://localhost:3000` in your browser. Send a chat. Confirm in the agentgateway logs that the request was proxied to your LLM provider.

{{% /steps %}}

## Next steps

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits and token budgets to LLM traffic." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
  {{< card path="/integrations/auth/" title="Add authentication" subtitle="Require JWTs from your IdP before calls reach the LLM." >}}
{{< /cards >}}
