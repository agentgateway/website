## About

The Copilot LLM provider sends requests to the GitHub Copilot API with a token from a Kubernetes Secret. The provider sets the upstream endpoint and the protocol headers that the Copilot API expects.

In Kubernetes, configure `ai.provider.copilot` on an {{< reuse "agw-docs/snippets/backend.md" >}} and supply the token through `policies.auth.secretRef`. The standalone `backendAuth: copilot` method discovers credentials on the gateway host. Kubernetes uses an explicit Secret instead.

## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

2. Set up an [agentgateway proxy]({{< link-hextra path="/documentation/setup/gateway/" >}}). The example uses the `agentgateway-proxy` Gateway.

3. Have a credential accepted by the Copilot API for an account with access to the model you want to use. The gateway does not obtain, exchange, or refresh this credential. An arbitrary GitHub personal access token might not work.

## Configure Copilot backend authentication

1. Save your Copilot token in an environment variable.

   ```sh
   export COPILOT_TOKEN='<your-copilot-token>'
   ```

2. Create a Secret that holds the token. The default resolver reads the `Authorization` key.

   ```sh
   kubectl create secret generic copilot-token \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=Authorization="$COPILOT_TOKEN"
   ```

   Example output:

   ```txt
   secret/copilot-token created
   ```

3. Create an {{< reuse "agw-docs/snippets/backend.md" >}} that selects the Copilot provider and references the Secret.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: copilot
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     ai:
       provider:
         copilot: {}
     policies:
       ai:
         routes:
           /v1/chat/completions: Completions
           /v1/messages: Messages
           /v1/responses: Responses
       auth:
         secretRef:
           name: copilot-token
   EOF
   ```

   Example output:

   ```txt
   agentgatewaybackend.agentgateway.dev/copilot created
   ```

   {{< reuse "agw-docs/snippets/review-table.md" >}} For more information, see the [API reference]({{< link-hextra path="/reference/api/#llmprovider" >}}).

   | Field | Description |
   | -- | -- |
   | `ai.provider.copilot` | Selects the Copilot LLM provider. The default upstream is `api.githubcopilot.com:443`, with TLS verification. The example sets an empty object, so the provider uses the model from the request. To override the model, set `ai.provider.copilot.model`. |
   | `policies.ai.routes` | Maps incoming paths to API formats. The example enables Chat Completions, Messages, and Responses. |
   | `policies.auth.secretRef.name` | Name of the credential Secret in the backend's namespace. |

   Copilot also works with an [{{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}}]({{< link-hextra path="/documentation/llm/models/" >}}). Set `provider: Copilot` and `parentRefs`, and supply the Secret through `spec.policies.auth.secretRef`.

4. Create an HTTPRoute that forwards requests to the Copilot backend.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: gateway.networking.k8s.io/v1
   kind: HTTPRoute
   metadata:
     name: copilot
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     parentRefs:
     - name: agentgateway-proxy
     rules:
     - backendRefs:
       - group: {{< reuse "agw-docs/snippets/group.md" >}}
         kind: {{< reuse "agw-docs/snippets/backend.md" >}}
         name: copilot
       matches:
       - path:
           type: Exact
           value: /v1/chat/completions
       - path:
           type: Exact
           value: /v1/messages
       - path:
           type: Exact
           value: /v1/responses
   EOF
   ```

   Example output:

   ```txt
   httproute.gateway.networking.k8s.io/copilot created
   ```

5. Verify that the controller accepted the backend and resolved the Secret. The reason must be `Accepted`. The reason `PartiallyValid` means that the Secret has a problem. For more information, see [Troubleshoot](#troubleshoot).

   ```sh
   kubectl get {{< reuse "agw-docs/snippets/backend.md" >}} copilot \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     -o jsonpath='{range .status.conditions[*]}{.type}={.status} reason={.reason}{"\n"}{end}'
   ```

   Example output:

   ```txt
   Accepted=True reason=Accepted
   ```

6. Get the gateway address.

   {{< reuse "agw-docs/snippets/agw-get-gateway-url-k8s.md" >}}

7. Send a request with a model that your Copilot account can use. The following example uses `gpt-4.1`. For local testing, set `INGRESS_GW_ADDRESS=localhost:8080` in the terminal where you send the request.

   ```sh
   curl --fail-with-body "http://$INGRESS_GW_ADDRESS/v1/chat/completions" \
     --header 'Content-Type: application/json' \
     --data '{
       "messages": [
         {
           "content": "Explain how AI works in simple terms.",
           "role": "user"
         }
       ],
       "model": "gpt-4.1"
     }'
   ```

   The route also accepts `/v1/messages` and `/v1/responses` with their corresponding request bodies. Choose an API format that the model supports. Set `"stream": true` in the request body for streaming.

The example uses the sample gateway's HTTP listener. Configure [client authentication and authorization]({{< link-hextra path="/documentation/security/" >}}) before exposing it to other callers. Copilot requests use the existing LLM policies, metrics, and tracing. Configure caller identity separately for per-user attribution.

## Where agentgateway finds the token

The controller resolves `policies.auth.secretRef` in the namespace of the {{< reuse "agw-docs/snippets/backend.md" >}}. It reads the `Authorization` key by default and sends the value as a bearer token. That key accepts a bare credential or one prefixed with `Bearer `.

To use another data key, set `policies.auth.secretRef.key`. Store the bare token under a custom key. Only the `Authorization` key strips an existing `Bearer ` prefix before the gateway adds it again.

An explicit Secret takes precedence over credentials on the gateway host. A missing Secret, missing key, or empty credential reports a configuration error and keeps an explicit empty backend credential. Requests cannot fall back to environment variables, Copilot configuration files, or GitHub CLI credentials on the gateway host.

> [!NOTE]
> The controller watches for Secret changes and updates the backend after reconciliation. Updating the token does not require a gateway restart. The gateway does not renew the token, and restarting the gateway does not extend its validity.

To revoke a credential, use its issuer's revocation process. Deleting or invalidating the Secret prevents host-credential fallback after reconciliation. It does not revoke the credential at GitHub or cancel requests already in flight.

## What agentgateway sends

The gateway writes the token to the `Authorization` header. The Copilot provider adds the following protocol headers after backend transformations and request-header modifiers.

| Header | Value |
| -- | -- |
| `authorization` | `Bearer` followed by the token. |
| `content-type` | `application/json`. |
| `editor-version` | `agentgateway/` followed by the version of the binary. |
| `openai-intent` | `conversation-agent`. |
| `x-github-api-version` | The Copilot API version that this release targets. |
| `x-initiator` | `agent`. |
| `x-interaction-type` | `conversation-agent`. |

The provider supplies these headers automatically. No manual header configuration is needed.

> [!WARNING]
> The provider sets `content-type` to `application/json` on every request and overwrites the value that the client sent. Use it for JSON API requests.

## Troubleshoot

Inspect the backend status for configuration errors. A Secret problem leaves `Accepted` at `True` and sets the reason to `PartiallyValid`, with the cause in the condition message. For example, `failed to translate backend: secret agentgateway-system/copilot-token not found`. Do not look for `Accepted: False`.

```sh
kubectl get {{< reuse "agw-docs/snippets/backend.md" >}} copilot \
  --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} -o yaml
```

| Symptom | Cause and resolution |
| -- | -- |
| The API server rejects the `copilot` provider field. | The installed CRDs do not include Kubernetes Copilot support. Use matching CRDs, controller, and data-plane builds that include the provider. |
| The backend rejects the token although the Secret resolves. | The credential is expired, is not accepted by the Copilot API, or lacks access to the selected model. Confirm the credential and account entitlement with GitHub. Upstream authentication and entitlement errors reach the client. |
| The condition message reports `secret <namespace>/<name> not found`. | The referenced Secret does not exist in the backend's namespace. Check `policies.auth.secretRef.name` and create the Secret in that namespace. |
| The condition message reports `missing Authorization value`. | The Secret's `Authorization` key is missing, empty, or contains only the `Bearer` scheme. Supply a valid credential, or set `secretRef.key` to the key that holds it. |
| The request fails with an unsupported conversion error. | The selected model does not accept the requested API format. Choose a model and request format that work together. |
| The upstream rejects the request body. | The provider sends `content-type: application/json`. Send a JSON body in the format expected by `/v1/chat/completions`, `/v1/messages`, or `/v1/responses`. |

## Clean up

Delete the resources that you created in this guide.

```sh
kubectl delete httproute copilot --namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} copilot --namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
kubectl delete secret copilot-token --namespace {{< reuse "agw-docs/snippets/namespace.md" >}}
```

Example output:

```txt
httproute.gateway.networking.k8s.io "copilot" deleted
agentgatewaybackend.agentgateway.dev "copilot" deleted
secret "copilot-token" deleted
```
