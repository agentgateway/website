With {{< reuse "agw-docs/snippets/agentgateway.md" >}}, you can route requests directly to an [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) agent runtime by using an `{{< reuse "agw-docs/snippets/backend.md" >}}` resource. You do not need a separate proxy, custom code, or the AWS SDK.

## About AWS Bedrock AgentCore {#about}

Amazon Bedrock AgentCore is a runtime that hosts deployed agents, each with its own invocation endpoint. To reach an AgentCore runtime, you supply its Amazon Resource Name (ARN) to an `{{< reuse "agw-docs/snippets/backend.md" >}}` of type `aws`. {{< reuse "agw-docs/snippets/agentgateway.md" >}} derives the connection details from the ARN: requests are sent over TLS to the `bedrock-agentcore` endpoint in the runtime's AWS region, with the path set to the runtime's invocation endpoint.

{{< reuse "agw-docs/snippets/agentgateway.md" >}} signs each request with AWS Signature Version 4 (SigV4) by using the standard [AWS credential lookup](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) from the proxy's environment. This way, you do not store long-lived credentials in the gateway configuration.

<!-- This page documents only the SigV4/IAM auth path, which is what the native aws.agentCore backend supports. A second AgentCore auth mode, a Cognito (OIDC) JWT authorizer, is NOT documented here yet. Working theory: a JWT-authorizer runtime is fronted with a plain `host`/static AgentgatewayBackend pointed at the bedrock-agentcore endpoint plus a backendAuth policy (key or passthrough, see /configuration/security/backend-authn/), NOT the aws.agentCore backend type, since SigV4 signing and a JWT bearer are likely mutually exclusive. Before documenting the Cognito JWT variant, confirm with engineering: (1) the exact Kubernetes AgentgatewayBackend + policy config for a JWT-authorizer runtime; (2) whether backendAuth can attach to an aws.agentCore backend at all, or only to a plain host backend; (3) the token-rotation story, since Cognito JWTs expire while SigV4/IRSA rotates automatically; (4) a validated end-to-end example. Issue solo-io/docs#1916 has Cognito-JWT and IRSA/SigV4 workshop gists that can seed this. -->

This integration does not use the A2A protocol. Because AgentCore is configured as an AWS backend, you do not set the `appProtocol: kgateway.dev/a2a` field or use the `a2a` backend type.

## Before you begin {#before-you-begin}

{{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}

Additionally, make sure that you have the following:

* An Amazon Bedrock AgentCore agent runtime that is deployed in your AWS account, and its ARN in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`.
* AWS credentials that are available to the {{< reuse "agw-docs/snippets/agentgateway.md" >}} proxy so that it can sign requests with SigV4. The proxy uses the standard AWS credential chain, such as an IAM role, environment variables, or an instance profile. On Amazon EKS, the recommended approach is [IAM Roles for Service Accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html): associate an IAM role that is allowed to invoke the AgentCore runtime with the proxy's Kubernetes service account. Unlike a static token, IRSA credentials rotate automatically.

## Step 1: Create a backend for the AgentCore runtime {#backend}

Create an `{{< reuse "agw-docs/snippets/backend.md" >}}` resource that represents the AgentCore runtime. The `aws.agentCore` settings point {{< reuse "agw-docs/snippets/agentgateway.md" >}} to the runtime that you want to invoke.

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

| Setting | Description |
| -- | -- |
| `aws.agentCore.agentRuntimeArn` | The ARN of the AgentCore agent runtime to invoke, in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`. {{< reuse "agw-docs/snippets/agentgateway.md" >}} derives the endpoint, region, and invocation path from this value. |
| `aws.agentCore.qualifier` | Optional. The runtime version or endpoint qualifier to invoke. If you omit this setting, the default endpoint is used. |

## Step 2: Route to the AgentCore backend {#route}

Create an HTTPRoute that routes incoming traffic to the `{{< reuse "agw-docs/snippets/backend.md" >}}`. The following route matches the `/agentcore` path so that the runtime has a unique address on the gateway. You do not need to rewrite the path, because {{< reuse "agw-docs/snippets/agentgateway.md" >}} rewrites the request to the runtime's invocation endpoint and signs it before it is sent upstream.

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

   If the request is signed successfully and the runtime is reachable, you get a response from your agent. If you get a `403` error, verify that the proxy's AWS credentials are allowed to invoke the AgentCore runtime.

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete HTTPRoute agentcore -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} agentcore-backend -n {{< reuse "agw-docs/snippets/namespace.md" >}} --ignore-not-found
```
