---
title: Agent-to-Agent
weight: 4
description: Learn how to enable secure communication between AI agents using the A2A protocol
---

Enable secure communication between AI agents using the A2A protocol.

## What you'll build

In this tutorial, you'll:
1. Run a sample A2A "Hello World" agent
2. Configure Agent Gateway to proxy A2A requests
3. Discover agent skills through the gateway
4. Send tasks to the agent and receive responses

## Prerequisites

- [uv](https://docs.astral.sh/uv/) installed (for running the sample agent)

## Overview

This tutorial requires **two terminal windows**:

| Terminal | Purpose |
|----------|---------|
| **Terminal 1** | Run the Hello World A2A agent on port 9999 |
| **Terminal 2** | Run Agent Gateway on port 3000 |

```
┌──────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   Playground │ ──── │  Agent Gateway   │ ──── │  Hello World    │
│   (Browser)  │      │     :3000        │      │  Agent :9999    │
└──────────────┘      └──────────────────┘      └─────────────────┘
                           Terminal 2              Terminal 1
```

---

## Terminal 1: Start the A2A Agent

### Step 1: Clone the sample agents

```bash
git clone https://github.com/a2aproject/a2a-samples.git
cd a2a-samples
```

### Step 2: Create environment file (optional)

```bash
cat > .env << 'EOF'
# Required for LLM-powered agents (not needed for hello world)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
EOF
```

{{< callout type="info" >}}
The Hello World agent doesn't require any API keys. The `.env` file is only needed if you want to try other agents like the LangGraph or Google ADK agents.
{{< /callout >}}

### Step 3: Start the Hello World agent

```bash
cd samples/python/agents/helloworld
uv run --python 3.12 .
```

{{< callout type="warning" >}}
**macOS users:** If you see a `pydantic-core` build error about Python version compatibility, make sure to use `--python 3.12` (or 3.11/3.13). Python 3.14 is not yet supported by some dependencies.
{{< /callout >}}

You should see:

```
INFO:     Uvicorn running on http://0.0.0.0:9999 (Press CTRL+C to quit)
```

**Keep this terminal running** and open a new terminal for the next steps.

---

## Terminal 2: Start Agent Gateway

### Step 4: Install Agent Gateway

```bash
curl -sL https://agentgateway.dev/install | bash
```

### Step 5: Create the config

```bash
cat > config.yaml << 'EOF'
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        cors:
          allowOrigins: ["*"]
          allowHeaders: [content-type, cache-control]
        a2a: {}
      backends:
      - host: localhost:9999
EOF
```

### Step 6: Start Agent Gateway

```bash
agentgateway -f config.yaml
```

You should see:

```
INFO agentgateway: Listening on 0.0.0.0:3000
INFO agentgateway: Admin UI available at http://localhost:15000/ui/
```

---

## Test in the Playground

### Step 7: Open the Playground

Visit [http://localhost:15000/ui/playground](http://localhost:15000/ui/playground):

1. Select your A2A route
2. Click **Connect** to discover the agent's skills
3. Select the "Returns hello world" skill
4. Type a message and click **Send Task**

You should see a response:

```json
{"kind":"text","text":"Hello World"}
```

![A2A Playground Test](/images/tutorials/a2a-playground-test.gif)

---

## What's happening?

- **Terminal 1**: The Hello World agent runs on port 9999 and handles A2A requests
- **Terminal 2**: Agent Gateway runs on port 3000 and proxies requests to the agent
- **Browser**: The Playground UI connects through Agent Gateway to interact with the agent

Agent Gateway provides:
- Automatic agent card URL rewriting to point to the gateway
- Add authentication, rate limiting, and observability transparently
- A unified endpoint for multiple backend agents

## Next Steps

{{< cards >}}
  {{< card link="/docs/tutorials/authorization" title="Authorization" subtitle="Add JWT authentication" >}}
  {{< card link="/docs/agent/" title="Agent Overview" subtitle="Understanding A2A connectivity" >}}
  {{< card link="/docs/agent/a2a" title="A2A Reference" subtitle="Complete A2A configuration" >}}
{{< /cards >}}
