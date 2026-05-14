---
title: LibreChat
description: Front LibreChat with agentgateway to centralize LLM credentials, audit, and rate limits.
---

[LibreChat](https://github.com/danny-avila/LibreChat) is an open-source, multi-user chat interface that supports many LLM providers. Configuring LibreChat with a single OpenAI-compatible custom endpoint pointed at agentgateway lets you keep provider keys server-side and apply policies once for all chats.

## What you get

- LibreChat sees one endpoint; agentgateway routes to the actual upstream model.
- API keys held by agentgateway, not by every LibreChat instance.
- Per-request metrics, traces, and audit logs across providers.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    LibreChat    │────▶│   agentgateway  │────▶│  LLM provider   │
│   (port 3080)   │     │   (port 3000)   │     │ (OpenAI, etc.)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Before you begin

1. [Install the agentgateway binary]({{< link-hextra path="/deployment/binary" >}}).
2. Have an LLM provider API key, such as an [OpenAI API key](https://platform.openai.com/api-keys).
3. Set up [LibreChat](https://www.librechat.ai/docs/local) via Docker Compose with MongoDB.

## Steps

{{% steps %}}

### Step 1: Configure agentgateway

Create a `config.yaml`:

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config

llm:
  port: 3000
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

### Step 3: Add agentgateway as a custom endpoint in LibreChat

LibreChat's [custom endpoints](https://www.librechat.ai/docs/configuration/librechat_yaml/object_structure/custom_endpoint) feature lets you add any OpenAI-compatible backend. Edit `librechat.yaml`:

```yaml
version: 1.2.1
cache: true

endpoints:
  custom:
    - name: "agentgateway"
      apiKey: "placeholder"
      baseURL: "http://localhost:3000/v1"
      models:
        default: ["gpt-4o", "gpt-4o-mini"]
        fetch: false
      titleConvo: true
      titleModel: "gpt-4o-mini"
      modelDisplayLabel: "agentgateway"
```

`apiKey` must be set, but it is not used to call the upstream provider — agentgateway holds the real key. Set it to any non-empty value or to a key you require LibreChat clients to present (and validate at the gateway).

Set `fetch: false` and list your models explicitly in `models.default`. Agentgateway does not expose a `/v1/models` endpoint, so `fetch: true` will result in an empty model list.

{{< callout type="info" >}}
If LibreChat runs in Docker and agentgateway runs on your host machine, replace `localhost` with `host.docker.internal`:

```yaml
baseURL: "http://host.docker.internal:3000/v1"
```
{{< /callout >}}

### Step 4: Enable registration and restart LibreChat

By default LibreChat disables new user registration. Add `ALLOW_REGISTRATION=true` to your LibreChat `.env` file so you can create an account:

```sh
ALLOW_REGISTRATION=true
```

Restart your LibreChat stack so it picks up the updated `librechat.yaml` and `.env`. In the UI, select **agentgateway** from the endpoint switcher and start a conversation. Confirm in the agentgateway logs that the request was proxied upstream.

{{% /steps %}}

## Next steps

{{< cards >}}
  {{< card path="/llm/spending/" title="Control spending" subtitle="Apply rate limits and token budgets across providers." >}}
  {{< card path="/llm/observability/" title="LLM observability" subtitle="Metrics, traces, and access logs for every LLM call." >}}
  {{< card path="/llm/providers/" title="LLM providers" subtitle="Add additional upstream providers behind the same endpoint." >}}
{{< /cards >}}
