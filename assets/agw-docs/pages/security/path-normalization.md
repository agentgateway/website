Normalize request paths before route matching, so that routes, policies, and the backend all see the same path.

## About path normalization {#about}

A client can write the same path in more than one way. For example, `/%68eaders`, `//headers`, and `/anything/../headers` all point to `/headers` on many backends. The gateway matches policies on the path as the client wrote it. If the backend decodes or cleans up the path before it serves the request, a client can bypass a path-based rule. For example, an authorization rule that denies `/headers` does not match `/%68eaders`, but the backend serves `/headers` for that request.

Path normalization closes this gap. The gateway rewrites the path before route matching. Route matching, policies such as authorization and rate limiting, and the request to the backend use the normalized path. Access logs keep the original path, so you can see what the client sent.

{{< conditional-text exclude-if="standalone" >}}
To turn on path normalization, list the rules in the `frontend.http.normalize` field of an {{< reuse "agw-docs/snippets/policy.md" >}} that targets a Gateway. The rules apply to all requests on that Gateway.

| Rule | Effect | Example |
| -- | -- | -- |
| `MergeSlash` | Collapses repeated slashes into one slash. A backslash (`\`) counts as a slash. | `//headers` becomes `/headers`. |
| `DotSegment` | Resolves `.` and `..` segments. `%2E` counts as `.`, and a backslash counts as a slash. The rule ignores parameters on dot segments, such as `;x` in `..;x`. | `/anything/../headers` becomes `/headers`. |
| `DecodeUnreserved` | Decodes percent-encoded unreserved characters: `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, and `~`. Other encoded characters stay encoded. | `/%68eaders` becomes `/headers`. |
| `RejectEscapedSlash` | Rejects a path that contains an encoded slash, `%2F` or `%5C`, with a `400` response. Do not use this rule if a backend expects encoded slashes in a path segment. You cannot set this rule together with `UnescapeSlash`. | `/anything/..%2Fheaders` returns `400`. |
| `UnescapeSlash` | Decodes `%2F` and `%5C` into `/`. You cannot set this rule together with `RejectEscapedSlash`. | `/anything%2Fheaders` becomes `/anything/headers`. |
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
To turn on path normalization, list the rules in the `frontendPolicies.http.normalize` field of the configuration file. The rules apply to all requests on every gateway.

| Rule | Effect | Example |
| -- | -- | -- |
| `mergeSlash` | Collapses repeated slashes into one slash. A backslash (`\`) counts as a slash. | `//headers` becomes `/headers`. |
| `dotSegment` | Resolves `.` and `..` segments. `%2E` counts as `.`, and a backslash counts as a slash. The rule ignores parameters on dot segments, such as `;x` in `..;x`. | `/anything/../headers` becomes `/headers`. |
| `decodeUnreserved` | Decodes percent-encoded unreserved characters: `A-Z`, `a-z`, `0-9`, `-`, `.`, `_`, and `~`. Other encoded characters stay encoded. | `/%68eaders` becomes `/headers`. |
| `rejectEscapedSlash` | Rejects a path that contains an encoded slash, `%2F` or `%5C`, with a `400` response. Do not use this rule if a backend expects encoded slashes in a path segment. You cannot set this rule together with `unescapeSlash`. | `/anything/..%2Fheaders` returns `400`. |
| `unescapeSlash` | Decodes `%2F` and `%5C` into `/`. You cannot set this rule together with `rejectEscapedSlash`. | `/anything%2Fheaders` becomes `/anything/headers`. |
{{< /conditional-text >}}

The gateway applies the rules in a fixed order, regardless of the order in the list. First, the gateway decodes or rejects percent-encoded characters. Then, the gateway merges slashes. Last, the gateway resolves dot segments.

When you set any rule other than the merge-slash rule, the gateway also checks every percent-encoded character in the path. The gateway rejects a path with a malformed escape, such as `%zz`, or an encoded null character, `%00`, with a `400` response and the body `invalid request`.

> [!NOTE]
> The rule names are in TitleCase in Kubernetes resources, such as `MergeSlash`, and in camelCase in the standalone configuration file, such as `mergeSlash`. A rule name in the wrong case fails validation.

{{< conditional-text exclude-if="standalone" >}}
{{< reuse "agw-docs/snippets/agentgateway/prereq.md" >}}

## Normalize request paths {#normalize}

Create an authorization policy that denies a path, and send a request that bypasses the policy with an encoded path. Then, turn on path normalization and verify that the gateway applies the policy to every form of the path.

1. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that denies requests to the `/headers` path of the httpbin app.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: deny-headers
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       authorization:
         action: Deny
         policy:
           matchExpressions:
           - "request.path.startsWith('/headers')"
   EOF
   ```

2. Send a request to `/headers` and a request to `/%68eaders`, which is `/headers` with an encoded `h`. The `--path-as-is` option stops curl from changing the path. The gateway denies the `/headers` request with a `403` response. The `/%68eaders` request does not match the policy, so the gateway forwards the request. The httpbin app decodes the path and returns the `/headers` response.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   for p in /headers /%68eaders; do
     echo "$p $(curl -s --path-as-is -o /dev/null -w '%{http_code}' http://$INGRESS_GW_ADDRESS:80$p -H 'host: www.example.com:80')"
   done
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   for p in /headers /%68eaders; do
     echo "$p $(curl -s --path-as-is -o /dev/null -w '%{http_code}' localhost:8080$p -H 'host: www.example.com')"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   /headers 403
   /%68eaders 200
   ```

3. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that turns on path normalization for the Gateway.

   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: path-normalization
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: Gateway
       name: agentgateway-proxy
     frontend:
       http:
         normalize:
         - MergeSlash
         - DotSegment
         - DecodeUnreserved
         - RejectEscapedSlash
   EOF
   ```

   | Setting | Description |
   | -- | -- |
   | `spec.targetRefs` | The Gateway to apply path normalization to. A policy with a `frontend` section must target a Gateway. A route target fails validation. |
   | `spec.frontend.http.normalize` | The normalization rules to apply, from 1 to 5 unique values. This example resolves the encoded, repeated-slash, and dot-segment forms of a path, and rejects encoded slashes. |

4. Send requests to different forms of the `/headers` path. The gateway normalizes each path before it applies the authorization policy, so the policy denies every form with a `403` response. The paths with an encoded slash and an encoded null character fail with a `400` response.

   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   for p in /headers /%68eaders //headers /anything/../headers /anything/..%2Fheaders /head%00ers; do
     echo "$p $(curl -s --path-as-is -o /dev/null -w '%{http_code}' http://$INGRESS_GW_ADDRESS:80$p -H 'host: www.example.com:80')"
   done
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   ```sh
   for p in /headers /%68eaders //headers /anything/../headers /anything/..%2Fheaders /head%00ers; do
     echo "$p $(curl -s --path-as-is -o /dev/null -w '%{http_code}' localhost:8080$p -H 'host: www.example.com')"
   done
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:

   ```console
   /headers 403
   /%68eaders 403
   //headers 403
   /anything/../headers 403
   /anything/..%2Fheaders 400
   /head%00ers 400
   ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

```sh
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} deny-headers -n httpbin
kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} path-normalization -n {{< reuse "agw-docs/snippets/namespace.md" >}}
```
{{< /conditional-text >}}
{{< conditional-text include-if="standalone" >}}
## Before you begin

1. {{< reuse "agw-docs/snippets/prereq-agentgateway.md" >}}
2. {{< reuse "agw-docs/snippets/prereq-docker.md" >}}

## Normalize request paths {#normalize}

Configure a route with an authorization rule that denies a path, and send a request that bypasses the rule with an encoded path. Then, turn on path normalization and verify that agentgateway applies the rule to every form of the path.

1. Start the httpbin sample app in Docker. The app listens on port 8000 on your machine.

   ```sh
   docker run -d --name httpbin -p 8000:8080 mccutchen/go-httpbin:v2.17.0
   ```

2. Create a configuration file with a route to the httpbin app. The route has an authorization rule that denies requests to the `/headers` path.

   ```yaml
   cat > config.yaml <<EOF
   # yaml-language-server: \$schema=https://agentgateway.dev/schema/config
   gateways:
     default:
       port: 3000
   routes:
   - backends:
     - host: localhost:8000
     policies:
       authorization:
         rules:
         - deny: 'request.path.startsWith("/headers")'
   EOF
   ```

3. Run agentgateway with the configuration file.

   ```sh
   agentgateway -f config.yaml
   ```

4. In another terminal, send a request to `/headers` and a request to `/%68eaders`, which is `/headers` with an encoded `h`. The `--path-as-is` option stops curl from changing the path. Agentgateway denies the `/headers` request with a `403` response. The `/%68eaders` request does not match the rule, so agentgateway forwards the request. The httpbin app decodes the path and returns the `/headers` response.

   ```sh
   for p in /headers /%68eaders; do
     echo "$p $(curl -s --path-as-is -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
   done
   ```

   Example output:

   ```console
   /headers 403
   /%68eaders 200
   ```

5. Add the `frontendPolicies` section to the top of the configuration file. Agentgateway reloads the file when it changes.

   ```yaml
   frontendPolicies:
     http:
       normalize: [mergeSlash, dotSegment, decodeUnreserved, rejectEscapedSlash]
   ```

   | Setting | Description |
   | -- | -- |
   | `frontendPolicies.http.normalize` | The normalization rules to apply to requests on every gateway. This example resolves the encoded, repeated-slash, and dot-segment forms of a path, and rejects encoded slashes. |

6. Send requests to different forms of the `/headers` path. Agentgateway normalizes each path before it applies the authorization rule, so the rule denies every form with a `403` response. The paths with an encoded slash and an encoded null character fail with a `400` response.

   ```sh
   for p in /headers /%68eaders //headers /anything/../headers /anything/..%2Fheaders /head%00ers; do
     echo "$p $(curl -s --path-as-is -o /dev/null -w '%{http_code}' http://localhost:3000$p)"
   done
   ```

   Example output:

   ```console
   /headers 403
   /%68eaders 403
   //headers 403
   /anything/../headers 403
   /anything/..%2Fheaders 400
   /head%00ers 400
   ```

## Cleanup

1. Stop agentgateway by pressing `Ctrl+C` in the terminal where agentgateway runs.

2. Remove the httpbin container and the configuration file.

   ```sh
   docker rm -f httpbin
   rm config.yaml
   ```
{{< /conditional-text >}}
