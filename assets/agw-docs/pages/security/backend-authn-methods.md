<!--
Do not put a version gate on a row in the middle of this table. A gate that
renders nothing leaves a blank line, which ends the table and silently drops every
row after it. Where a row applies to some versions only, either say so in the
cell, as the jwtSign row does, or make it the last row of the table.

Hugo parses shortcode syntax inside an HTML comment too, so do not write a sample
gate here: an unclosed one fails the whole build.
-->
Agentgateway supports the following backend authentication methods. Most methods are available both in the standalone binary and in Kubernetes, but the field names and the shape of the configuration differ between the two modes.

| Method | What the gateway sends to the backend | Standalone | Kubernetes |
| -- | -- | -- | -- |
| `key` | A static credential that you set in the configuration. | Yes | Yes |
| `secretRef` | A static credential that the gateway reads from a Kubernetes Secret. | No | Yes |
| `passthrough` | The credential that the client sent, forwarded unchanged. | Yes | Yes |
| `aws` | An AWS Signature Version 4 signature over the request. | Yes | Yes |
| `azure` | A Microsoft Entra ID token for an Azure service. | Yes | Yes |
| `gcp` | A Google access token or ID token. | Yes | Yes |
| `copilot` | A GitHub Copilot token, with the request headers that Copilot expects. | Yes | No |
| `jwtSign` | A short-lived JWT that the gateway signs with your private key on every request. | 1.5.x and later | 1.5.x and later |
| `oauthTokenExchange` | A token that the gateway gets by exchanging the client credential at an OAuth authorization server. | Yes | Yes |
| `crossAppAccess` | A token that the gateway gets with the OAuth Identity Assertion Authorization Grant. | Yes | Yes |
| `credentials` | One or more extra credentials, each written to its own location. | Yes | Yes |

Two entries in the table are not like the others.

* **The `credentials` list is additive, not a choice.** Every other entry is a primary method, and a policy sets at most one of them. The `credentials` list is independent, so you can set it on its own, or set it together with a primary method to send a second credential such as a subscription key.
* **The `copilot` method is available in the standalone binary only.** The method reads its token from the environment of the gateway process, which has no Kubernetes equivalent, so the field does not exist in the custom resources.

Every other method is available in both modes and in every version that this table appears in. The `jwtSign` method arrived in 1.5.x, so a 1.4.x gateway rejects a configuration that sets it.
