With {{< reuse "agw-docs/snippets/agentgateway.md" >}}, you can route requests directly to an [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) agent runtime by using an `{{< reuse "agw-docs/snippets/backend.md" >}}` resource. You do not need a separate proxy, custom code, or the AWS SDK.

> [!NOTE]
> Unlike connecting to [agent-to-agent (A2A) servers]({{< link-hextra path="/agent/a2a/" >}}), this integration does not use the A2A protocol. AgentCore is configured as an AWS backend, so you do not set the `appProtocol: kgateway.dev/a2a` field or use the `a2a` backend type.

## About AWS Bedrock AgentCore {#about}

Amazon Bedrock AgentCore is a runtime that hosts deployed agents, each with its own invocation endpoint. To reach an AgentCore runtime, you supply its Amazon Resource Name (ARN) to an `{{< reuse "agw-docs/snippets/backend.md" >}}` of type `aws`. {{< reuse "agw-docs/snippets/agentgateway.md" >}} uses the ARN to determine where to send each request. It connects over TLS to the `bedrock-agentcore` endpoint in the runtime's AWS region, then rewrites the request path to target the specific runtime. You do not construct the endpoint or encode the ARN yourself.

### Authentication {#authentication}

AgentCore runtimes support two authentication modes, which you choose when you deploy the runtime in AWS. The `aws.agentCore` backend supports both:

* **IAM (SigV4)**: The default. {{< reuse "agw-docs/snippets/agentgateway.md" >}} signs each request with AWS Signature Version 4 (SigV4) by using the standard [AWS credential lookup](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) from the proxy's environment, such as [IRSA](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html) on Amazon EKS. You do not store long-lived credentials in the gateway configuration, and IRSA credentials rotate automatically.
* **JWT authorizer** (for example, Amazon Cognito): The runtime validates an OIDC bearer token on each request. To use this mode, attach a backend authentication policy that sends the token in the `Authorization` header. This overrides the default SigV4 signing. Unlike SigV4 credentials, a JWT expires, so you must refresh the token in the backing Kubernetes Secret before it expires.


## Before you begin {#before-you-begin}

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

Additionally, make sure that you have the following:

* An Amazon Bedrock AgentCore agent runtime that is deployed in your AWS account, and its ARN in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`.
* Credentials for the runtime's authentication mode:
  * For **IAM (SigV4)**, AWS credentials that are available to the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy and that are allowed to invoke the runtime. The proxy uses the standard AWS credential chain, such as an IAM role, environment variables, or an instance profile. On Amazon EKS, the recommended approach is [IAM Roles for Service Accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html): associate an IAM role with the proxy's Kubernetes service account.
  * For a **JWT authorizer**, a valid OIDC bearer token that the runtime's authorizer accepts, such as an Amazon Cognito access or ID token.

## Step 1: Create a backend for the AgentCore runtime {#backend}

Create an `{{< reuse "agw-docs/snippets/backend.md" >}}` resource that represents the AgentCore runtime. The `aws.agentCore` settings point {{< reuse "agw-docs/snippets/agentgateway.md" >}} to the runtime that you want to invoke. The configuration depends on the runtime's [authentication mode](#authentication).

{{< tabs >}}
{{% tab name="IAM (SigV4)" %}}
Create the backend with only the `aws.agentCore` settings. {{< reuse "agw-docs/snippets/agentgateway.md" >}} signs each request with SigV4 by using the proxy's environment credentials. You do not add an authentication policy.

```yaml
kubectl apply -f- <<EOF
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/backend.md" >}}
metadata:
  name: agentcore-backend
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  aws:
    agentCore:
      agentRuntimeArn: arn:aws:bedrock-agentcore:us-west-2:111122223333:runtime/my-agent-runtime
      # qualifier: production
EOF
```
{{% /tab %}}
{{% tab name="JWT authorizer" %}}
1. Store the bearer token that the runtime's authorizer accepts in a Kubernetes Secret. When you use the default Secret resolver, the token must be stored under the `Authorization` key.

   ```sh
   kubectl create secret generic agentcore-jwt \
     --namespace {{< reuse "agw-docs/snippets/namespace.md" >}} \
     --from-literal=Authorization="$AGENTCORE_JWT"
   ```

2. Create the backend and reference the Secret with a `policies.auth.secretRef` setting. {{< reuse "agw-docs/snippets/agentgateway.md" >}} sends the token in the `Authorization` header with a `Bearer` prefix, which overrides the default SigV4 signing. The endpoint, region, and invocation path are still derived from the ARN.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: agentcore-backend
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     aws:
       agentCore:
         agentRuntimeArn: arn:aws:bedrock-agentcore:us-west-2:111122223333:runtime/my-agent-runtime
         # qualifier: production
     policies:
       auth:
         secretRef:
           name: agentcore-jwt
   EOF
   ```
{{% /tab %}}
{{< /tabs >}}

| Setting | Description |
| -- | -- |
| `aws.agentCore.agentRuntimeArn` | The ARN of the AgentCore agent runtime to invoke, in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`. {{< reuse "agw-docs/snippets/agentgateway.md" >}} derives the endpoint, region, and invocation path from this value. |
| `aws.agentCore.qualifier` | Optional. The runtime version or endpoint qualifier to invoke. If you omit this setting, the default endpoint is used. |
| `policies.auth` | Optional. Overrides the default authentication for the backend. Omit this setting to sign requests with SigV4 (IAM). To authenticate to a runtime that uses a JWT authorizer, set `policies.auth.secretRef` (or `policies.auth.key`) to a bearer token. By default, the token is sent in the `Authorization` header with a `Bearer` prefix. When you use `secretRef` with the default resolver, store the token under the Secret's `Authorization` key. |

## Step 2: Route to the AgentCore backend {#route}

Create an HTTPRoute that routes incoming traffic to the `{{< reuse "agw-docs/snippets/backend.md" >}}`. The following route matches the `/agentcore` path so that the runtime has a unique address on the gateway. You do not need to rewrite the path, because {{< reuse "agw-docs/snippets/agentgateway.md" >}} replaces the entire request path with the runtime's invocation endpoint before the request is sent upstream. As a result, any subpath that a client appends after `/agentcore` is not forwarded to the runtime.

```yaml
kubectl apply -f- <<EOF
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: agentcore
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  parentRefs:
  - name: agentgateway-proxy
    namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /agentcore
    backendRefs:
      - name: agentcore-backend
        group: {{< reuse "agw-docs/snippets/group.md" >}}
        kind: {{< reuse "agw-docs/snippets/backend.md" >}}
EOF
```

Optionally, add a `RequestHeaderModifier` filter to the route rule to identify the calling user to the AgentCore runtime. AgentCore uses the `X-Amzn-Bedrock-AgentCore-Runtime-User-Id` header to associate requests with a user session.

```yaml
    filters:
    - type: RequestHeaderModifier
      requestHeaderModifier:
        set:
        - name: X-Amzn-Bedrock-AgentCore-Runtime-User-Id
          value: user-123
```

## Step 3: Verify the connection {#verify}

1. Get the {{< reuse "agw-docs/snippets/agentgateway.md" >}} address.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   export INGRESS_GW_ADDRESS=$(kubectl get gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} -o=jsonpath="{.status.addresses[0].value}")
   echo $INGRESS_GW_ADDRESS
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80
   ```
   {{% /tab %}}
   {{< /tabs >}}

2. Send a request to the AgentCore runtime through the gateway. The request body depends on the agent that you deployed to the runtime. The following example sends a simple prompt.

   ```sh
   curl -X POST http://$INGRESS_GW_ADDRESS/agentcore \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello from agentgateway!"}'
   ```

   If the runtime is reachable and the request is authenticated, you get a response from your agent. A `403` error indicates an authentication problem: for IAM, verify that the proxy's AWS credentials are allowed to invoke the runtime; for a JWT authorizer, verify that the token in the Secret is valid and not expired.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete HTTPRoute agentcore -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} agentcore-backend -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete secret agentcore-jwt -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
