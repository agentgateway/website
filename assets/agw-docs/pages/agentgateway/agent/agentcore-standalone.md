With {{< reuse "agw-docs/snippets/agentgateway.md" >}}, you can route requests directly to an [Amazon Bedrock AgentCore](https://aws.amazon.com/bedrock/agentcore/) agent runtime with an `aws.agentCore` backend. You do not need a separate proxy, custom code, or the AWS SDK.

{{< reuse "agw-docs/snippets/kgateway-callout.md" >}}

## About AWS Bedrock AgentCore {#about}

Amazon Bedrock AgentCore is a runtime that hosts deployed agents, each with its own invocation endpoint. To reach an AgentCore runtime, you supply its Amazon Resource Name (ARN) to an `aws.agentCore` backend. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} derives every connection detail from that ARN, so you do not construct the endpoint or encode the ARN yourself.

For an ARN in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`, {{< reuse "agw-docs/snippets/agentgateway.md" >}} does the following:

* Connects to `bedrock-agentcore.<region>.amazonaws.com` on port 443 over TLS, with the system trust store.
* Replaces the request path with `/runtimes/<url-encoded-ARN>/invocations`.
* Signs the request with AWS Signature Version 4 (SigV4) under the `bedrock-agentcore` signing name, unless a backend authentication policy overrides the signing.

The ARN must carry `bedrock-agentcore` as its service element. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} rejects any other ARN when it loads the configuration.

> [!NOTE]
> AgentCore identifies a runtime entirely by its ARN, and the request path is replaced in full. A subpath that a client appends to the route, such as `/agentcore/my-agent`, is dropped, and the request still reaches the ARN in the backend. To route to more than one runtime, create a separate backend and route for each one. To target a different version or endpoint of the same runtime, set `qualifier`.

### Authentication {#authentication}

AgentCore runtimes support two authentication modes, which you choose when you deploy the runtime in AWS. Both modes work with an `aws.agentCore` backend.

{{< tabs >}}
{{% tab name="IAM (SigV4)" %}}
IAM (SigV4) is the default mode, and needs no policy. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} signs each request with the [default AWS credential chain](https://docs.aws.amazon.com/sdkref/latest/guide/access.html) from its environment, such as environment variables, a shared credentials file, or an instance profile. To assume a role before signing, or to sign with an explicit access key, set a `backendAuth.aws` policy. For the full set of AWS options, see [AWS backend authentication]({{< link-hextra path="/configuration/security/backend-authn/providers/aws/" >}}).
{{% /tab %}}
{{% tab name="JWT authorization" %}}
The AgentCore runtime validates an OIDC bearer token on each request. To use this mode, set a `backendAuth.key` policy on the backend. The policy replaces SigV4 signing, so requests carry the token instead of a signature.

This mode works only if the AgentCore runtime was deployed with **Inbound Auth** configured to accept JSON Web Tokens, which AWS calls a `customJWTAuthorizer`. The authorizer's `discoveryUrl` and `allowedClients` list must match the token that you send. The token's issuer (`iss`) must match the discovery URL's user pool, and the token's client ID must be in `allowedClients`. You configure Inbound Auth when you deploy the runtime in AWS, not on the gateway. For more information, see the [AgentCore Identity documentation](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/what-is-bedrock-agentcore.html).

Unlike SigV4 credentials, a JWT expires. Read the token from a file so that you can rotate it without a restart, as described in [Step 1](#backend).
{{% /tab %}}
{{< /tabs >}}

{{< doc-test paths="agentcore-standalone" >}}
{{< reuse "agw-docs/snippets/install-agentgateway-binary.md" >}}
export AGENTCORE_JWT="${AGENTCORE_JWT:-test-token}"
{{< /doc-test >}}

## Before you begin {#before-you-begin}

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. Deploy an Amazon Bedrock AgentCore agent runtime in your AWS account, and get its ARN. For steps to build and deploy a runtime, see the [Amazon Bedrock AgentCore documentation](https://docs.aws.amazon.com/bedrock-agentcore/).
3. Get credentials for the runtime's [authentication mode](#authentication).
   {{< tabs >}}
{{% tab name="IAM (SigV4)" %}}
For **IAM (SigV4)**, make AWS credentials that are allowed to invoke the runtime available to {{< reuse "agw-docs/snippets/agentgateway.md" >}}. The credential chain reads environment variables, `~/.aws/config` and `~/.aws/credentials`, a web identity token, container credentials, and IMDSv2, and it stops at the first source that returns credentials.
{{% /tab %}}
{{% tab name="JWT authorization" %}}
For a **JWT authorizer** such as Amazon Cognito, the AgentCore runtime must be deployed with Inbound Auth configured to accept JSON Web Tokens, with the correct discovery URL and allowed client ID for the identity provider that issues your tokens. You also need a valid OIDC bearer token that the runtime's authorizer accepts.

For Amazon Cognito, use the **access token** (`AuthenticationResult.AccessToken`), not the ID token. AgentCore validates the token's `client_id` claim against the runtime's `allowedClients`. Cognito puts the client ID in the `client_id` claim of an access token, but in the `aud` claim of an ID token, so an ID token fails with a `client_id` mismatch.
{{% /tab %}}
   {{< /tabs >}}

## Step 1: Configure the AgentCore backend {#backend}

Create a configuration file with a route to the AgentCore runtime. The `aws.agentCore` settings name the runtime that you want to invoke, and the configuration depends on the runtime's [authentication mode](#authentication).

{{< tabs >}}
{{% tab name="IAM (SigV4)" %}}
1. Create a configuration file with an `aws.agentCore` backend and no authentication policy. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} signs each request with SigV4 by using the credentials in its environment. Replace the `agentRuntimeArn` value with the ARN of your runtime.

   ```yaml {paths="agentcore-standalone"}
   cat <<'EOF' > config.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - matches:
     - path:
         pathPrefix: /agentcore
     backends:
     - aws:
         agentCore:
           agentRuntimeArn: arn:aws:bedrock-agentcore:us-west-2:111122223333:runtime/my-agent-runtime
   EOF
   ```

2. Start {{< reuse "agw-docs/snippets/agentgateway.md" >}} with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```
{{% /tab %}}
{{% tab name="JWT authorization" %}}
1. Save the bearer token that the runtime's authorizer accepts to a file. The following example writes the token that is in the `AGENTCORE_JWT` environment variable.

   ```sh {paths="agentcore-standalone"}
   echo -n "$AGENTCORE_JWT" > agentcore-token.jwt
   ```

2. Create a configuration file with an `aws.agentCore` backend and a `backendAuth.key` policy that reads the token from the file. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} sends the token in the `Authorization` header with a `Bearer` prefix, which replaces SigV4 signing. Replace the `agentRuntimeArn` value with the ARN of your runtime.

   ```yaml {paths="agentcore-standalone"}
   cat <<'EOF' > config-jwt.yaml
   # yaml-language-server: $schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - matches:
     - path:
         pathPrefix: /agentcore
     backends:
     - aws:
         agentCore:
           agentRuntimeArn: arn:aws:bedrock-agentcore:us-west-2:111122223333:runtime/my-agent-runtime
       policies:
         backendAuth:
           key:
             value:
               file: ./agentcore-token.jwt
   EOF
   ```

3. Start {{< reuse "agw-docs/snippets/agentgateway.md" >}} with the configuration file.

   ```sh
   agentgateway -f config-jwt.yaml
   ```

   > [!TIP]
   > A file reference is watched. To rotate an expiring token, write a new token to `agentcore-token.jwt`, and {{< reuse "agw-docs/snippets/agentgateway.md" >}} picks up the new token without a restart. An inline string value has no such refresh path.
{{% /tab %}}
{{< /tabs >}}

| Setting | Description |
| -- | -- |
| `aws.agentCore.agentRuntimeArn` | The ARN of the AgentCore agent runtime to invoke, in the format `arn:aws:bedrock-agentcore:<region>:<account-id>:runtime/<runtime-id>`. {{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} derives the endpoint, the signing region, and the invocation path from this value. |
| `aws.agentCore.qualifier` | Optional. The runtime version or endpoint qualifier to invoke, which is sent as a `qualifier` query parameter. Omit this setting to use the runtime's `DEFAULT` endpoint, as this example does. |
| `policies.backendAuth` | Optional. Replaces the default SigV4 signing for the backend. Omit this setting to sign requests with the AWS credential chain. To authenticate to a runtime that uses a JWT authorizer, set `backendAuth.key.value` to the token, either as a `file` reference or as an inline string. The token goes in the `Authorization` header with a `Bearer` prefix, unless you set `backendAuth.key.location`. |
| `policies.requestHeaderModifier` | Optional. Headers to set before the request is sent upstream, such as the `X-Amzn-Bedrock-AgentCore-Runtime-User-Id` header that AgentCore uses to associate requests with a user session. Omit this setting to send the request headers unchanged, as this example does. |

To reuse one AgentCore backend across several routes, move the backend to a top-level `backends` entry and reference it by name. The reference is namespace-qualified, so a backend in the default namespace needs a leading slash.

```yaml
backends:
- name: agentcore
  aws:
    agentCore:
      agentRuntimeArn: arn:aws:bedrock-agentcore:us-west-2:111122223333:runtime/my-agent-runtime
routes:
- matches:
  - path:
      pathPrefix: /agentcore
  backends:
  - backend: /agentcore
```

## Step 2: Verify the connection {#verify}

1. Send a request to the AgentCore runtime through {{< reuse "agw-docs/snippets/agentgateway.md" >}}. The request body depends on the agent that you deployed to the runtime. The following example sends a simple prompt.

   ```sh
   curl -X POST http://localhost:3000/agentcore \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello from agentgateway!"}'
   ```

   Example output: The agent responds with its own payload format.

   ```json
   {"result": {"role": "assistant", "content": [{"text": "Hello! How can I help you today?"}]}}
   ```

2. In the terminal where {{< reuse "agw-docs/snippets/agentgateway.md" >}} runs, verify that the request log names the AgentCore endpoint for the runtime's region.

   ```text
   info	request gateway=default/default listener=default route=default/route0 endpoint=bedrock-agentcore.us-west-2.amazonaws.com:443 src.addr=[::1]:49215 http.method=POST http.host=localhost http.path=/agentcore http.version=HTTP/1.1 http.status=200 protocol=http duration=437ms
   ```

3. If the request fails, use the response and the request log to tell an authentication problem from a routing problem. A log line that carries an `error=` field and `reason=UpstreamFailure` means that {{< reuse "agw-docs/snippets/agentgateway.md" >}} failed before it sent the request. A response that carries an `x-amzn-requestid` header came from AWS.

   | Response | Cause |
   | -- | -- |
   | `403` with `The security token included in the request is invalid` | The SigV4 credentials that {{< reuse "agw-docs/snippets/agentgateway.md" >}} resolved are not valid. Check the credential source that the chain reached first. |
   | `403` from a JWT authorizer | The token is expired, or it does not match the runtime's Inbound Auth settings. Check the discovery URL, the allowed client ID, and that you sent an access token. |
   | `404` with `No endpoint or agent found with qualifier` | The ARN or the `qualifier` value does not name a deployed runtime endpoint. The message reports the qualifier that was used, which is `DEFAULT` when you omit the setting. |
   | `500` with `backend authentication failed` | {{< reuse "agw-docs/snippets/agentgateway.md" >}} could not resolve credentials at all, so no request was signed. A failed `assumeRole` call reports this way. |

{{< doc-test paths="agentcore-standalone" >}}
# WHAT THIS TEST VALIDATES:
#   * Both AgentCore configurations on this page, the SigV4 default and the
#     backendAuth.key JWT override, are accepted by agentgateway. The JWT
#     config is validated only after the token file exists, because
#     --validate-only reads a `file` reference and fails when it is missing.
# WHAT THIS TEST DOES NOT VALIDATE (and why):
#   * That requests reach a runtime and return an agent response — requires an
#     AWS account with a deployed AgentCore runtime, which the page omits.
agentgateway -f config.yaml --validate-only
agentgateway -f config-jwt.yaml --validate-only
{{< /doc-test >}}

## Clean up {#cleanup}

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Stop {{< reuse "agw-docs/snippets/agentgateway.md" >}} in the terminal where it runs.

2. Remove the configuration file and the token file.

   ```sh {paths="agentcore-standalone"}
   rm -f config.yaml config-jwt.yaml agentcore-token.jwt
   ```
