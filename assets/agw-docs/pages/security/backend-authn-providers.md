Some backends do not accept a credential that you can hold. A managed cloud service issues its own short-lived tokens, and it expects the caller to prove an identity that the cloud itself recognizes. The AWS, Azure, and Google Cloud methods cover that case: the gateway authenticates as itself and exchanges its own identity for a token that the service accepts. The GitHub Copilot method works differently, because the gateway sends an existing Copilot token instead of exchanging an identity.

## When to use a provider method

Use a provider method when the backend is an AWS, Azure, or Google Cloud service, or the GitHub Copilot API. Use a {{% conditional-text include-if="kubernetes" %}}[static key]({{< link-hextra path="/documentation/security/backend-authn/key/" >}}){{% /conditional-text %}}{{% conditional-text include-if="standalone" %}}[static key]({{< link-hextra path="/documentation/configuration/security/backend-authn/key/" >}}){{% /conditional-text %}} instead when the service issues you a long-lived API key, even if that service happens to run on one of those clouds.

For AWS, Azure, and Google Cloud, workload identity lets the gateway authenticate without storing a credential. On a managed cluster the platform already gives the gateway an identity: a Google service account through Workload Identity on GKE, an IAM role for a service account on EKS, or an Azure workload identity on AKS. Each of these providers also accepts an explicit credential when the ambient identity is not the one you want, or when the gateway does not run on that cloud.

## What the gateway sends

Three of the four attach a bearer token to the request. AWS is the exception: it signs the whole request instead, so it runs last, after every other policy that changes the request.

| Provider | What the gateway attaches | Credential source |
| -- | -- | -- |
| AWS | An AWS Signature Version 4 signature | An IAM role for a service account, EKS Pod Identity, or an EC2 instance profile |
| Azure | A Microsoft Entra ID token in the `Authorization` header | An Azure workload identity or a managed identity |
| GitHub Copilot | A Copilot token, plus the request headers that the Copilot API expects | {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}A Kubernetes Secret, or local token discovery in standalone mode{{< /version >}}{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}}Local token discovery in standalone mode{{< /version >}} |
| Google Cloud | An access token or an ID token in the `Authorization` header | A Google service account through Workload Identity, or the metadata server |

The AWS, Azure, and Google Cloud methods resolve implicit credentials through a chain of sources, and stop at the first one that answers. The order matters whenever more than one source is present, so each page documents its own chain.

## First request latency

The AWS, Azure, and Google Cloud methods resolve implicit credentials on the first request that needs them, not at startup. That first request therefore pays the cost of the exchange, and can take several seconds. The gateway caches the result, so later requests do not. A route that is slow only on its first call after a restart is showing this, not a misconfiguration.

## Guides

{{% conditional-text include-if="kubernetes" %}}The following guides cover AWS, Azure, and Google Cloud.{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x" >}} The [GitHub Copilot guide]({{< link-hextra path="/documentation/security/backend-authn/providers/copilot/" >}}) shows how to supply the token from a Kubernetes Secret.{{< /version >}}{{% /conditional-text %}}
{{% conditional-text include-if="standalone" %}}The following guides cover each of the four provider methods, including GitHub Copilot.{{% /conditional-text %}}
