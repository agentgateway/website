---
title: Virtual models
weight: 47
description: Configure virtual models with weighted, failover, and conditional routing in simplified LLM mode.
test:
  virtual-models:
  - file: ${versionRoot}/llm/virtual-models.md
    path: virtual-models
---

{{< doc-test paths="virtual-models" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * All three example configs are accepted by agentgateway (--validate-only),
#     covering `llm.virtualModels[].routing.weighted.targets[].weight`,
#     `routing.failover.targets[].priority`, and `routing.conditional.targets[].when`.
#   * "Public and internal models": with each config loaded, the served model list
#     contains the virtual model and any `visibility: public` model, and omits every
#     `visibility: internal` model. This turns the prose description of `public` and
#     `internal` into an observable assertion:
#       - weighted    -> gpt-4o-public, smart      (2 internal targets hidden)
#       - failover    -> resilient                 (all 3 targets are internal)
#       - conditional -> openai-public, adaptive   (2 internal targets hidden)
#     The failover case is the clearest: every target is internal, so only the
#     virtual entrypoint is exposed.
#
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That traffic is actually split 90/10 by `weight` - external dependency;
#     observing the split needs many live completions against OpenAI.
#   * That failover moves to a lower `priority` target on failure, and that
#     same-priority targets are load balanced "based on health and latency" -
#     external dependency; triggering a real upstream failure needs live providers.
#   * That `when` expressions select a target by request header - requires
#     config/traffic the page omits; the page shows no request example, and
#     confirming which internal target served a response needs a live provider
#     call.
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}

# The example configs read API keys from the environment. --validate-only and the
# model listing still resolve env vars, so placeholders are enough here.
export OPENAI_API_KEY="${OPENAI_API_KEY:-test}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-test}"

# Assert that a config serves exactly the expected client-facing models, which is
# what `visibility: public` / `internal` controls.
assert_models() {
  local cfg="$1" expected="$2"
  agentgateway -f "$cfg" &
  local pid=$!
  sleep 3
  local served
  served=$(curl -sf --max-time 10 http://localhost:4000/v1/models | jq -cr '[.data[].id] | sort')
  kill $pid 2>/dev/null
  wait $pid 2>/dev/null
  if [ "$served" != "$expected" ]; then
    echo "FAIL: $cfg should serve $expected but served $served"
    exit 1
  fi
  echo "✓ $cfg serves $expected (internal targets are not exposed)"
}
{{< /doc-test >}}

Virtual models let you publish one client-facing model name and route requests across one or more internal target models.

Use `llm.virtualModels[]` to define the virtual entrypoint and `llm.models[]` as the concrete upstream targets.

## Public and internal models

Use `llm.models[].visibility` to control whether a model is directly exposed to clients or kept as an internal target.

- `public`: The model can be requested directly by clients and can also be used as a virtual model target.
- `internal`: The model is intended for internal routing targets and is not exposed as a direct client model.

## Route selection modes

Each virtual model defines its routing strategy under `routing`.
The routing targets in a virtual model point to concrete `llm.models[]` entries.

### Weighted routing

Use `routing.weighted.targets` to split traffic between targets with `weight`.

```yaml
llm:
  models:
  - name: gpt-4o-public
    visibility: public
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: gpt-4o-primary
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: gpt-4o-fallback
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: smart
    routing:
      weighted:
        targets:
        - model: gpt-4o-primary
          weight: 90
        - model: gpt-4o-fallback
          weight: 10
```

{{< doc-test paths="virtual-models" >}}
cat <<'EOF' > config-weighted.yaml
llm:
  models:
  - name: gpt-4o-public
    visibility: public
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: gpt-4o-primary
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"
  - name: gpt-4o-fallback
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: smart
    routing:
      weighted:
        targets:
        - model: gpt-4o-primary
          weight: 90
        - model: gpt-4o-fallback
          weight: 10
EOF
agentgateway -f config-weighted.yaml --validate-only
assert_models config-weighted.yaml '["gpt-4o-public","smart"]'
{{< /doc-test >}}

### Failover routing

Use `routing.failover.targets` and `priority` to define ordered failover targets.
Targets with the same priority are load balanced across based on health and latency.

```yaml
llm:
  models:
  - name: claude-primary
    visibility: internal
    provider: anthropic
    params:
      model: claude-sonnet-4-0
      apiKey: "$ANTHROPIC_API_KEY"
  - name: claude-backup-a
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
  - name: claude-backup-b
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"

  virtualModels:
  - name: resilient
    routing:
      failover:
        targets:
        - model: claude-primary
          priority: 1
        - model: claude-backup-a
          priority: 2
        - model: claude-backup-b
          priority: 2
```

{{< doc-test paths="virtual-models" >}}
cat <<'EOF' > config-failover.yaml
llm:
  models:
  - name: claude-primary
    visibility: internal
    provider: anthropic
    params:
      model: claude-sonnet-4-0
      apiKey: "$ANTHROPIC_API_KEY"
  - name: claude-backup-a
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
  - name: claude-backup-b
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"

  virtualModels:
  - name: resilient
    routing:
      failover:
        targets:
        - model: claude-primary
          priority: 1
        - model: claude-backup-a
          priority: 2
        - model: claude-backup-b
          priority: 2
EOF
agentgateway -f config-failover.yaml --validate-only
assert_models config-failover.yaml '["resilient"]'
{{< /doc-test >}}

### Conditional routing

Use `routing.conditional.targets` and `when` expressions to select targets by request context.

```yaml
llm:
  models:
  - name: openai-public
    visibility: public
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: openai-fast
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: openai-smart
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: adaptive
    routing:
      conditional:
        targets:
        - model: openai-fast
          when: request.headers["x-tier"] == "free"
        - model: openai-smart
          when: request.headers["x-tier"] == "pro"
```

{{< doc-test paths="virtual-models" >}}
cat <<'EOF' > config-conditional.yaml
llm:
  models:
  - name: openai-public
    visibility: public
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: openai-fast
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o-mini
      apiKey: "$OPENAI_API_KEY"
  - name: openai-smart
    visibility: internal
    provider: openAI
    params:
      model: gpt-4o
      apiKey: "$OPENAI_API_KEY"

  virtualModels:
  - name: adaptive
    routing:
      conditional:
        targets:
        - model: openai-fast
          when: request.headers["x-tier"] == "free"
        - model: openai-smart
          when: request.headers["x-tier"] == "pro"
EOF
agentgateway -f config-conditional.yaml --validate-only
assert_models config-conditional.yaml '["adaptive","openai-public"]'
{{< /doc-test >}}

> [!NOTE]
> For reusable provider defaults in simplified mode, see [Multiple LLM providers]({{< link-hextra path="/llm/providers/multiple-llms/" >}}).
