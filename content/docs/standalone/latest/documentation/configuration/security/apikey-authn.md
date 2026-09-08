---
title: API Key authentication
weight: 17
description: Authenticate requests using API keys with configurable validation modes.
test:
  apikey-authn:
  - file: ${versionRoot}/documentation/configuration/security/apikey-authn.md
    path: apikey-authn
---

Attaches to: {{< badge content="Listener" path="/documentation/configuration/listeners/">}} {{< badge content="Route" path="/documentation/configuration/routes/">}}

{{< reuse "agw-docs/snippets/config-styles-note.md" >}}

{{< doc-test paths="apikey-authn" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
{{< /doc-test >}}

{{< gloss "API Key" >}}API key{{< /gloss >}} {{< gloss "Authentication (AuthN)" >}}authentication{{< /gloss >}} enables authenticating requests based on a user-provided API key.

> [!TIP]
> This policy is about authenticating incoming requests. For attaching API keys to outgoing requests, see [Backend Authentication](../backend-authn).

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

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The apiKey authentication policy is accepted by agentgateway in all three
#     configuration forms: routing-based (gateways), simplified LLM (llm.policies),
#     and simplified MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That a request with the given key is actually authenticated at runtime —
#     requires a backend the page omits to forward to.
cat <<'EOF' > config.yaml
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
EOF
agentgateway -f config.yaml --validate-only

cat <<'EOF' > config-llm.yaml
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
EOF
agentgateway -f config-llm.yaml --validate-only

cat <<'EOF' > config-mcp.yaml
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
EOF
agentgateway -f config-mcp.yaml --validate-only
{{< /doc-test >}}

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

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The apiKey config combined with a transformation that sets a header from
#     API key metadata is accepted by agentgateway in all three configuration
#     forms: routing-based (gateways), simplified LLM (llm.policies), and simplified
#     MCP (mcp.policies).
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the x-authenticated-user header is actually set at runtime —
#     requires a backend the page omits to forward to and inspect.
cat <<'EOF' > config2.yaml
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
EOF
agentgateway -f config2.yaml --validate-only

cat <<'EOF' > config2-llm.yaml
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
EOF
agentgateway -f config2-llm.yaml --validate-only

cat <<'EOF' > config2-mcp.yaml
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
EOF
agentgateway -f config2-mcp.yaml --validate-only
{{< /doc-test >}}

## LLM budgets and model access

An API key entry can carry two fields that apply to LLM traffic. The `budgets` field sets a per-key budget that caps what the key spends. The `allowedModels` field limits which models the key can reach. Both fields work with a `key` entry and with a `keyHash` entry.

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
| `allowedModels` | Model name patterns that the key can reach. Each entry is an exact name or a pattern with one `*` wildcard. Omit the field to leave the key unconstrained, or set an empty list to deny every model. You cannot combine `*` with another pattern. |
| `budgets` | List of budgets that are charged independently after each LLM response. |
| `budgets[].name` | Names the budget within its key. The name must be unique among that key's budgets. |
| `budgets[].limit.unit` | `USD` to cap realized cost, or `Tokens` to cap token usage. |
| `budgets[].limit.amount` | The maximum usage in the window. A `Tokens` amount must be a whole number. A `USD` amount takes up to nine decimal places. |
| `budgets[].window.rolling` | Length of the fixed usage window, such as `1h`, `24h`, or `30d`. Windows are aligned to the Unix epoch rather than to the key's first request. |
| `budgets[].onBudgetExceeded` | `Block` to reject requests with a `429` after the limit is passed, or `Audit` to record the overage and allow the request. |

Two requirements apply to `budgets` only, and agentgateway refuses to start if either is unmet:

- The configuration must set `config.database.url`, because agentgateway stores budget counts in a database. Setting `config.logging.database.url` instead does not satisfy this requirement, because that field configures request logging only. For more information, see [Configuration storage]({{< link-hextra path="/documentation/setup/storage/" >}}).
- Every key that has a budget must set `metadata.name`, which identifies the key in budget counts, logs, and the admin API.

The `allowedModels` field has neither requirement, so you can use it without a database.

For a walkthrough that enforces both fields and checks the results, see [Per-key dollar or token budgets]({{< link-hextra path="/documentation/llm/cost-controls/budget-limits/per-key/" >}}).

{{< doc-test paths="apikey-authn" >}}
# WHAT THIS TEST VALIDATES:
#   * The budgets and allowedModels fields on an API key entry are accepted by
#     agentgateway when config.database and metadata.name are both set.
#   * The two documented startup errors are the ones agentgateway actually
#     reports when each requirement is unmet, which is what the prose claims.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * Budget charging and model rejection at runtime. Those need an LLM
#     provider and are covered by the budget-limits guide's doc test.
cat <<'EOF' > config3.yaml
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
EOF
agentgateway -f config3.yaml --validate-only

# A budget without config.database is rejected at startup.
python3 - <<'PY'
import pathlib
src = pathlib.Path("config3.yaml").read_text()
start = src.index("config:")
end = src.index("llm:")
pathlib.Path("config3-no-db.yaml").write_text(src[:start] + src[end:])
PY
# Capture the output first. Under `set -o pipefail` a pipeline would inherit
# agentgateway's non-zero exit, which is the expected result here, not a failure.
no_db_out=$(agentgateway -f config3-no-db.yaml --validate-only 2>&1 || true)
echo "$no_db_out" | grep -q "API key budgets require config.database to be configured" \
  || { echo "expected the documented config.database error, got: $no_db_out"; exit 1; }

# A budget without metadata.name is rejected at startup.
python3 - <<'PY'
import pathlib
src = pathlib.Path("config3.yaml").read_text()
pathlib.Path("config3-no-name.yaml").write_text(src.replace("          name: team-a\n", ""))
PY
no_name_out=$(agentgateway -f config3-no-name.yaml --validate-only 2>&1 || true)
echo "$no_name_out" | grep -q "API keys with budgets must have a metadata.name" \
  || { echo "expected the documented metadata.name error, got: $no_name_out"; exit 1; }

# allowedModels alone needs no database.
python3 - <<'PY'
import pathlib
src = pathlib.Path("config3-no-db.yaml").read_text()
start = src.index("        budgets:")
end = src.index("  models:")
pathlib.Path("config3-models-only.yaml").write_text(src[:start] + src[end:])
PY
agentgateway -f config3-models-only.yaml --validate-only
{{< /doc-test >}}
