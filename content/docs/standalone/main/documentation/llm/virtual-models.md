---
title: Virtual models
weight: 47
description: Configure virtual models with weighted, failover, and conditional routing in simplified LLM mode.
test:
  virtual-models:
  - file: ${versionRoot}/documentation/llm/virtual-models.md
    path: virtual-models
---

{{< doc-test paths="virtual-models" >}}
# ============================================================================
# Doc test coverage for this guide (these comments are not rendered on the page)
# ============================================================================
# WHAT THIS TEST VALIDATES:
#   * All three example configs are accepted by agentgateway (--validate-only),
#     covering `llm.virtualModels[].routing.weighted.targets[].weight`,
#     `routing.failover.targets[].priority`, `llm.models[].health.eviction`,
#     and `routing.conditional.targets[].when`.
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
#   * That failover moves to a lower `priority` target after `health.eviction`
#     removes the primary, and that same-priority targets are load balanced by
#     health and latency - external dependency; triggering a real upstream
#     failure needs live providers.
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

Use failover (also called automatic fallback) to keep serving when a primary model fails or becomes unavailable. Configure `routing.failover.targets` with `priority` on the virtual model, and configure `health.eviction` on the concrete target models so unhealthy backends can leave the active set.

Failover has two levels of grouping:

- **Priority groups**: Targets with the same `priority` form one group. Lower priority values are preferred first. For example, priorities `0`, `0`, and `1` become `[[a, b], [c]]`.
- **Within a group**: Agentgateway load balances across targets by using a composite score of health and latency. Healthier, faster targets are favored.

Across priority groups, traffic moves to the next group only after every target in the current group is **evicted**. Lowering a health score alone is not enough to spill over to the next priority.

#### Health vs eviction

Configure health on the concrete `llm.models[]` entries that the virtual model targets (not on the virtual model itself).

| Setting | What it does |
| -- | -- |
| No `health` policy | Unhealthy responses (by default, `5xx` or connection failures) still lower the endpoint health score used for within-group load balancing. Endpoints are never evicted, so traffic never fails over to the next priority. |
| `health` without `eviction` | Same score-based weighting within a group. Eviction (and thus cross-priority failover) happens only when agentgateway can derive an eviction duration from elsewhere: `backoff` on a retry policy, or a `Retry-After` header on a 429 that is classified as unhealthy. |
| `health.eviction` | Removes an unhealthy endpoint from the active set for a backoff period. When every endpoint in a priority group is evicted, later requests use the next priority. |

> [!WARNING]
> Setting `routing.failover` alone does **not** switch to a lower-priority target after errors. You must set `health.eviction` on the primary (and typically backup) concrete models. Without eviction, requests keep hitting the highest-priority group forever.

Useful `health` fields:

- `unhealthyExpression`: Optional CEL expression; `true` marks the response unhealthy. When unset, any `5xx`, non-zero gRPC status, or connection failure is unhealthy.
- `eviction.duration`: Base time to keep an endpoint evicted. When you omit `duration`, agentgateway uses the `Retry-After` value from a 429 response, then the `backoff` from a retry policy, and then a default of `3s`. Repeated evictions use multiplicative backoff, with no upper bound.
- `eviction.consecutiveFailures`: Unhealthy responses required before eviction. When this and `healthThreshold` are both unset, a single unhealthy response can evict.
- `eviction.healthThreshold`: Evict when the endpoint health score (0.0–1.0) is below this value. Either this or `consecutiveFailures` can trigger eviction when both are set.
- `eviction.restoreHealth`: Optional health score (0.0–1.0) to apply when the endpoint returns from eviction.

Failover is driven by eviction of the active set, not by rewriting a single in-flight request to another target. The request that triggers eviction still fails unless you also configure retries so a later attempt can re-select a provider after eviction.

```yaml
llm:
  models:
  - name: claude-primary
    visibility: internal
    provider: anthropic
    params:
      model: claude-sonnet-4-0
      apiKey: "$ANTHROPIC_API_KEY"
    health:
      eviction:
        consecutiveFailures: 1
        duration: 60s
  - name: claude-backup-a
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
    health:
      eviction:
        consecutiveFailures: 1
        duration: 60s
  - name: claude-backup-b
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
    health:
      eviction:
        consecutiveFailures: 1
        duration: 60s

  virtualModels:
  - name: resilient
    routing:
      failover:
        targets:
        - model: claude-primary
          priority: 0
        - model: claude-backup-a
          priority: 1
        - model: claude-backup-b
          priority: 1
```

In this example:

1. Requests prefer `claude-primary` (`priority: 0`).
2. After an unhealthy response meets the eviction thresholds, `claude-primary` is removed from the active set for `duration`.
3. Later requests fail over to the `priority: 1` group and load balance between `claude-backup-a` and `claude-backup-b` by health and latency.
4. Within that backup group, a degraded target is weighted down; the other backup continues to receive more traffic until the degraded target recovers or is also evicted.

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
    health:
      eviction:
        consecutiveFailures: 1
        duration: 60s
  - name: claude-backup-a
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
    health:
      eviction:
        consecutiveFailures: 1
        duration: 60s
  - name: claude-backup-b
    visibility: internal
    provider: anthropic
    params:
      model: claude-3-5-haiku-20241022
      apiKey: "$ANTHROPIC_API_KEY"
    health:
      eviction:
        consecutiveFailures: 1
        duration: 60s

  virtualModels:
  - name: resilient
    routing:
      failover:
        targets:
        - model: claude-primary
          priority: 0
        - model: claude-backup-a
          priority: 1
        - model: claude-backup-b
          priority: 1
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
> For reusable provider defaults in simplified mode, see [Multiple LLM providers]({{< link-hextra path="/documentation/llm/providers/multiple-llms/" >}}).
