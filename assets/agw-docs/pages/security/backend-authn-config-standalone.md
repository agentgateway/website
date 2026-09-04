## Configure backend authentication

In the standalone binary, backend authentication is the `backendAuth` policy. Attach it to one backend, or to a route so that it covers every backend on that route.

```yaml
# yaml-language-server: $schema=https://agentgateway.dev/schema/config
gateways:
  default:
    port: 3000
routes:
- backends:
  - host: backend.example.com:443
    policies:
      backendAuth:
        key:
          value: $MY_API_KEY
```

| Where you set it | Field |
| -- | -- |
| One backend | `routes[].backends[].policies.backendAuth` |
| Every backend on a route | `routes[].policies.backendAuth` |
| The simplified MCP style | `mcp.policies.backendAuth` |
| One model in the simplified LLM style | `llm.models[].auth` |

> [!NOTE]
> The simplified LLM style is the one exception to the field name. A model sets `auth`, not `backendAuth`, and it takes the same settings. There is no `llm.policies.backendAuth`: that policy list covers requests on the way in, before a model is selected, so agentgateway rejects a `backendAuth` entry in it.

For how agentgateway resolves a policy that is set at more than one level, see [Attachment points]({{< link-hextra path="/configuration/policies/attachment/" >}}).

## Next

Each method has its own page.

| Method | Page |
| -- | -- |
| Static keys, passthrough, and extra credentials | [Static keys and passthrough]({{< link-hextra path="/configuration/security/backend-authn/key/" >}}) |
| AWS, Azure, Google Cloud, and GitHub Copilot | [Cloud provider credentials]({{< link-hextra path="/configuration/security/backend-authn/providers/" >}}) |
| Signed JWT | [Signed JWT]({{< link-hextra path="/configuration/security/backend-authn/jwt-sign/" >}}) |
| OAuth token exchange | [OAuth token exchange]({{< link-hextra path="/configuration/security/backend-authn/oauth-token-exchange/" >}}) |
| Cross App Access | [Cross App Access]({{< link-hextra path="/configuration/security/backend-authn/cross-app-access/" >}}) |

For the client side of authentication, see [JWT authentication]({{< link-hextra path="/configuration/security/jwt-authn/" >}}), [API Key authentication]({{< link-hextra path="/configuration/security/apikey-authn/" >}}), and [Basic authentication]({{< link-hextra path="/configuration/security/basic-authn/" >}}). To control which callers are allowed through, see [HTTP authorization]({{< link-hextra path="/configuration/security/http-authz/" >}}) and [MCP authorization]({{< link-hextra path="/configuration/security/mcp-authz/" >}}).

{{< reuse "agw-docs/pages/security/backend-authn-mode-differences.md" >}}
