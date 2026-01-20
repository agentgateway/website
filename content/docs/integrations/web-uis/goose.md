---
title: Goose
description: Secure and observe Goose autonomous agent with Agent Gateway for enterprise governance
---

[Goose](https://github.com/block/goose) is an autonomous AI agent developed by Block that can perform complex tasks by combining LLM reasoning with tool execution. It uses MCP (Model Context Protocol) for tool interactions, making it ideal for Agent Gateway integration.

## What is Goose?

Goose is a developer-focused AI agent that can:

- Execute shell commands and scripts
- Read and write files
- Browse the web and interact with APIs
- Use MCP tools for extended capabilities
- Chain multiple actions to complete complex tasks
- Maintain context across long-running sessions

## Why Use Agent Gateway with Goose?

Autonomous agents like Goose require careful governance because they can:
- Make multiple LLM calls per task
- Execute arbitrary tools and commands
- Access sensitive data and systems
- Accumulate significant costs quickly

| Risk | Agent Gateway Mitigation |
|------|-------------------------|
| Uncontrolled LLM spending | Token budgets and rate limits |
| Unauthorized tool access | MCP tool authorization policies |
| Data exfiltration | Content filtering and DLP |
| No audit trail | Complete logging of all agent actions |
| Shadow AI usage | Centralized visibility and control |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Goose       │────▶│  Agent Gateway  │────▶│   LLM Provider  │
│   (Agent)       │     │                 │     │  (Anthropic)    │
└─────────────────┘     │  - Auth         │     └─────────────────┘
        │               │  - Audit        │
        │               │  - Policies     │     ┌─────────────────┐
        └──────────────▶│  - Rate Limit   │────▶│   MCP Servers   │
           MCP          └─────────────────┘     │  (Tools)        │
                                                └─────────────────┘
```

## Configuration

### 1. Configure Agent Gateway for LLM and MCP

```yaml
listeners:
  - name: llm-listener
    address: 0.0.0.0
    port: 8080
    protocol: HTTP

  - name: mcp-listener
    address: 0.0.0.0
    port: 8081
    protocol: MCP

llm:
  providers:
    - name: anthropic
      type: anthropic
      api_key: ${ANTHROPIC_API_KEY}

mcp:
  servers:
    - name: filesystem
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    - name: github
      transport: stdio
      command: npx
      args: ["-y", "@modelcontextprotocol/server-github"]
```

### 2. Configure Goose

Configure Goose to route LLM requests through Agent Gateway using environment variables:

```bash
# For OpenAI-compatible endpoint via Agent Gateway
export GOOSE_PROVIDER=openai
export OPENAI_HOST=localhost:8080
export OPENAI_API_KEY=your-gateway-api-key

# For Anthropic via Agent Gateway
export GOOSE_PROVIDER=anthropic
export ANTHROPIC_HOST=localhost:8080
export ANTHROPIC_API_KEY=your-gateway-api-key
```

Or configure via the interactive setup:

```bash
goose configure
```

For MCP extensions, add them via the Goose settings or edit `~/.config/goose/config.yaml`:

```yaml
extensions:
  - name: filesystem
    enabled: true
    type: stdio
    cmd: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    timeout: 300
```

### 3. Add Security Policies

Restrict what Goose can do:

```yaml
authorization:
  policies:
    # Limit which tools Goose can use
    - name: goose-tool-policy
      principals: ["agent:goose"]
      resources:
        - "mcp:tool:filesystem/*"
        - "mcp:tool:github/read_*"
      action: allow

    # Block dangerous tools
    - name: block-dangerous
      principals: ["*"]
      resources:
        - "mcp:tool:*/execute_*"
        - "mcp:tool:*/delete_*"
      action: deny
```

## Governance Capabilities

### Complete Audit Trail

Track every action Goose takes:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "agent": "goose",
  "session_id": "abc123",
  "action": "mcp_tool_call",
  "tool": "filesystem/read_file",
  "parameters": {"path": "/src/main.py"},
  "result": "success",
  "tokens_used": 1500,
  "latency_ms": 250
}
```

### Token Budgets

Prevent runaway costs with per-session limits:

```yaml
rate_limiting:
  - name: goose-session-budget
    match:
      headers:
        x-session-id: "*"
    limit: 100000  # tokens
    window: 1h
    limit_by: tokens
```

### Tool Authorization

Control MCP tool access with fine-grained policies:

```yaml
mcp:
  authorization:
    # Allow read operations
    - tool_pattern: "*/read_*"
      action: allow

    # Require approval for writes
    - tool_pattern: "*/write_*"
      action: audit
      require_approval: true

    # Block destructive operations
    - tool_pattern: "*/delete_*"
      action: deny
```

### Content Filtering

Prevent sensitive data exposure:

```yaml
content_filtering:
  rules:
    - name: block-secrets
      patterns:
        - "(?i)api[_-]?key"
        - "(?i)password"
        - "(?i)secret"
      action: redact
```

## A2A Governance

If Goose communicates with other agents via A2A protocol:

```yaml
a2a:
  authorization:
    - name: goose-a2a-policy
      source_agent: goose
      target_agents:
        - "code-review-agent"
        - "documentation-agent"
      allowed_capabilities:
        - "review_code"
        - "generate_docs"
```

## Observability

Monitor Goose activity with:

- **Session Dashboards** - Track tasks, tool calls, and outcomes
- **Cost Attribution** - Token usage per session and task type
- **Error Analysis** - Failed tool calls and LLM errors
- **Security Alerts** - Policy violations and anomalies

Example Prometheus metrics:

```promql
# Tool calls by Goose
sum(rate(agentgateway_mcp_tool_calls_total{agent="goose"}[5m])) by (tool)

# Token consumption
sum(agentgateway_llm_tokens_total{agent="goose"}) by (model)
```

## Best Practices

1. **Start Restrictive** - Begin with minimal tool permissions and expand as needed
2. **Enable Audit Logging** - Always log tool calls for compliance
3. **Set Token Budgets** - Prevent unexpected costs from long-running tasks
4. **Use Session Isolation** - Each Goose session should have its own identity
5. **Monitor Anomalies** - Alert on unusual patterns of tool usage
