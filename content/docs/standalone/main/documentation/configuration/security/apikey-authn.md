---
title: API Key authentication
weight: 17
description: Authenticate requests using API keys with configurable validation modes.
---

Attaches to: {{< badge content="Listener" path="/documentation/configuration/listeners/">}} {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< gloss "API Key" >}}API key{{< /gloss >}} {{< gloss "Authentication (AuthN)" >}}authentication{{< /gloss >}} enables authenticating requests based on a user-provided API key.

> [!TIP]
> This policy is about authenticating incoming requests. For attaching API keys to outgoing requests, see [Backend Authentication](../backend-authn).
>
> Agentgateway removes validated API keys before forwarding requests. For LLM traffic, give clients virtual keys and keep provider keys on the gateway. See [Virtual keys]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/" >}}).

## Configure API key authentication

API Key authentication involves configuring a list of valid API keys, with associated metadata about the key (optional).

Additionally, authentication can run in three different modes:
* **Strict**: A valid API key must be present.
* **Optional** (default): If an API key exists, validate it.  
  *Warning*: This allows requests without an API key!
* **Permissive**: Requests are never rejected. This setting is useful for usage of claims in later steps such as authorization or logging.  
  *Warning*: This allows requests without an API key!

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
routes:
- backends:
  - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

Later policies can now operate on the metadata associated with the API key. For example, you can set a custom `x-authenticated-user` header with the authenticated user from the API key metadata by adding a route-level transformation.

{{< tabs >}}
{{< tab name="Simplified (LLM)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```
{{< /tab >}}
{{< tab name="Simplified (MCP)" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
mcp:
  port: 3000
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  targets:
  - name: everything
    stdio:
      cmd: npx
      args: ["@modelcontextprotocol/server-everything"]
```
{{< /tab >}}
{{< tab name="Routing-based" >}}
```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          user: test
          role: admin
routes:
- policies:
    transformations:
      request:
        set:
          x-authenticated-user: apiKey.user
  backends:
  - host: localhost:8080
```
{{< /tab >}}
{{< /tabs >}}

## LLM budgets and model access

To generate hashed LLM keys and manage their restrictions at runtime, see [Set up virtual keys (agctl)]({{< link-hextra path="/documentation/llm/cost-controls/virtual-keys/#agctl" >}}). The `agctl standalone keys` command manages the keys in `llm.policies.apiKey.keys`. An API key policy that you attach directly to an HTTP route or to the MCP configuration stays part of the resource that contains it.

An API key entry can carry two fields that apply to LLM traffic. The `budgets` field sets a per-key budget that caps what the key spends. The `allowedModels` field limits the top-level model that the key can request. Provider server-side tools, such as the Anthropic advisor tool, can use models outside the list. Both fields work with a `key` entry and with a `keyHash` entry.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
config:
  database:
    url: sqlite://budgets.db
llm:
  policies:
    apiKey:
      mode: strict
      keys:
      - key: sk-testkey-1
        metadata:
          name: team-a
          user: test
        allowedModels:
        - "gpt-5*"
        - claude-sonnet-5
        budgets:
        - name: daily-spend
          limit:
            unit: USD
            amount: 50
          window:
            rolling: 24h
          onBudgetExceeded: Block
  models:
  - name: "*"
    provider: openAI
    params:
      apiKey: "$OPENAI_API_KEY"
```

| Setting | Description |
| -- | -- |
| `allowedModels` | Model name patterns that can match the request's top-level model. Each entry is an exact name or a pattern with one `*` wildcard. Omit the field to leave the key unconstrained, or set an empty list to deny every model. The field does not check models that provider server-side tools use. You cannot combine `*` with another pattern. |
| `budgets` | List of budgets that are charged independently after each LLM response. |
| `budgets[].name` | Names the budget within its key. The name must be unique among that key's budgets. |
| `budgets[].limit.unit` | `USD` to cap realized cost, or `Tokens` to cap token usage. |
| `budgets[].limit.amount` | The maximum usage for the budget. A `Tokens` amount must be a whole number. A `USD` amount takes up to nine decimal places. |
| `budgets[].window` | Optional rolling-window block. Omit this block when the budget must keep accumulating usage and never reset. |
| `budgets[].window.rolling` | Length of the fixed usage window, such as `1h`, `24h`, or `30d`. Windows are aligned to the Unix epoch rather than to the key's first request. |
| `budgets[].onBudgetExceeded` | `Block` to reject requests with a `429` after the limit is passed, or `Audit` to record the overage and allow the request. |

Two requirements apply to `budgets` only, and agentgateway refuses to start if either is unmet:

- The configuration must set `config.database.url`, because agentgateway stores budget counts in a database. Setting `config.logging.database.url` instead does not satisfy this requirement, because that field configures request logging only. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).
- Every key that has a budget must set `metadata.name`, which identifies the key in budget counts, logs, and the admin API.

The `allowedModels` field has neither requirement, so you can use it without a database.

For a walkthrough that enforces both fields and checks the results, see [Per-key dollar or token budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}).
