---
title: Rewrites
weight: 13
description: Modify URL hostnames and paths of incoming requests dynamically.
test:
  rewrites:
  - file: content/docs/standalone/main/configuration/traffic-management/rewrites.md
    path: rewrites
---

Attaches to: {{< badge content="Route" path="/configuration/routes/">}}

{{< doc-test paths="rewrites" >}}
{{< reuse "agw-docs/snippets/install-agentgateway.md" >}}
{{< /doc-test >}}

Modify URLs of incoming requests with {{< gloss "Rewrite" >}}rewrite{{< /gloss >}} policies.

For example, the following configuration modifies the request hostname to `example.com` and the request path to `/new-path`.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: example.com
          path:
            full: /new-path
      backends:
      - host: example.com:443
```

{{< doc-test paths="rewrites" >}}
# WHAT THIS TEST VALIDATES:
#   * The urlRewrite example config is accepted by agentgateway.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That the hostname/path are actually rewritten at runtime — requires a
#     backend the page omits to forward to and inspect.
cat <<'EOF' > config.yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
binds:
- port: 3000
  listeners:
  - routes:
    - policies:
        urlRewrite:
          authority:
            full: example.com
          path:
            full: /new-path
      backends:
      - host: example.com:443
EOF
agentgateway -f config.yaml --validate-only
{{< /doc-test >}}