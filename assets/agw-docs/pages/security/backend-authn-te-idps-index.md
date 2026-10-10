Exchange tokens at the token endpoint of a specific identity provider (IdP).

## About

Most IdPs implement the same token exchange grants, so you configure all of them with the generic `oauthTokenExchange` method. What differs from one IdP to the next is the detail: the token endpoint and its path, the token types that the IdP accepts, how the gateway authenticates to the IdP, and any vendor-specific parameters. The guides in this section show those settings for a specific IdP, and walk through the setup on the IdP side.

To exchange tokens at an authorization server that does not have a guide in this section, start from the {{% conditional-text exclude-if="standalone" %}}[standard token exchange]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/standard/" >}}) or [JWT bearer grant]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/jwt-bearer/" >}}){{% /conditional-text %}}{{% conditional-text include-if="standalone" %}}[standard token exchange]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/standard/" >}}) or [JWT bearer grant]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/jwt-bearer/" >}}){{% /conditional-text %}} guide, and check which grants the server supports.

## Identity providers {#providers}

{{< conditional-text exclude-if="standalone" >}}
| Identity provider | Grant | Client authentication | Guide |
| -- | -- | -- | -- |
| Google Cloud Security Token Service, with Workload Identity Federation | Token exchange (RFC 8693) | None | [Google Cloud]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/idps/google/" >}}) |
| Microsoft Entra ID, on-behalf-of flow | JWT bearer (RFC 7523), with `requested_token_use=on_behalf_of` | Client secret or certificate | [Microsoft Entra on-behalf-of]({{< link-hextra path="/documentation/security/backend-authn/token-exchange/jwt-bearer/#entra-obo" >}}) |
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
| Identity provider | Grant | Client authentication | Guide |
| -- | -- | -- | -- |
| Google Cloud Security Token Service, with Workload Identity Federation | Token exchange (RFC 8693) | None | [Google Cloud]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/idps/google/" >}}) |
| Microsoft Entra ID, on-behalf-of flow | JWT bearer (RFC 7523), with `requested_token_use=on_behalf_of` | Client secret or certificate | [Microsoft Entra on-behalf-of]({{< link-hextra path="/documentation/configuration/security/backend-authn/token-exchange/jwt-bearer/#entra-obo" >}}) |
{{< /conditional-text >}}
