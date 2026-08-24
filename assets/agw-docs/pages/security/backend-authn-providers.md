Some backends do not accept a credential that you can hold. A managed cloud service issues its own short-lived tokens, and it expects the caller to prove an identity that the cloud itself recognizes. The provider methods cover that case: the gateway authenticates as itself and exchanges its own identity for a token that the service accepts.

## When to use a provider method

Use a provider method when the backend is an AWS, Azure, or Google Cloud service, or the GitHub Copilot API. Use a static key instead when the service issues you a long-lived API key, even if that service happens to run on one of those clouds.

The value of a provider method is that no credential has to be stored. On a managed cluster the platform already gives the gateway an identity: a Google service account through Workload Identity on GKE, an IAM role for a service account on EKS, or an Azure workload identity on AKS. The gateway uses that identity directly, so there is no secret to rotate and nothing to leak. Each provider also accepts an explicit credential, which is the fallback for the cases where the ambient identity is not the one you want, or where the gateway does not run on that cloud at all.

## What the gateway sends

Three of the four attach a bearer token to the request. AWS is the exception: it signs the whole request instead, so it runs last, after every other policy that changes the request.

| Provider | What the gateway attaches | Ambient identity it can use |
| -- | -- | -- |
| AWS | An AWS Signature Version 4 signature | An IAM role for a service account, EKS Pod Identity, or an EC2 instance profile |
| Azure | A Microsoft Entra ID token in the `Authorization` header | An Azure workload identity or a managed identity |
| Google Cloud | An access token or an ID token in the `Authorization` header | A Google service account through Workload Identity, or the metadata server |
| GitHub Copilot, in the standalone binary only | A Copilot token, plus the request headers that the Copilot API expects | A token in the environment of the gateway process |

Each provider resolves an implicit credential through a chain of sources, and stops at the first one that answers. The order matters whenever more than one source is present, so each page documents its own chain.

## First request latency

A provider method resolves its credential on the first request that needs it, not at startup. That first request therefore pays the cost of the exchange, and can take several seconds. The gateway caches the result, so later requests do not. A route that is slow only on its first call after a restart is showing this, not a misconfiguration.

## Guides
