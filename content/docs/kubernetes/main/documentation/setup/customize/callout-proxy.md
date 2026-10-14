---
title: Callout proxy
weight: 40
description: Send the requests that the agentgateway proxy makes on its own behalf, such as external authorization calls and cloud credential fetches, through a forward proxy.
---

In networks where outbound traffic must leave through a corporate HTTP proxy, you can send the requests that the agentgateway proxy makes on its own behalf through that forward proxy. These requests are called callouts. Callouts that use TLS go through the forward proxy in an HTTP CONNECT tunnel, and plaintext callouts go to the forward proxy as standard forward-proxy requests.

## About callouts

A callout is any request that the agentgateway proxy sends for itself rather than for a client. Callouts include the following requests.

* External authorization, external processing, and remote rate limit requests.
* Guardrail requests, such as webhooks, OpenAI moderation, AWS Bedrock Guardrails, Google Model Armor, and Azure AI Content Safety.
* OpenID Connect (OIDC) requests from the agentgateway proxy.
* Virtual model callout routing requests.
* Credential fetches from cloud providers, such as AWS, Azure, and Google Cloud Platform (GCP).

The callout proxy does not apply to the following traffic.

* **Client traffic to your backends**: This traffic is not a callout. To send the traffic to one backend through a forward proxy, set the `tunnel` policy on that backend instead. For more information, see [Backend tunnel proxy]({{< link-hextra path="/integrations/llm/providers/backend-tunnel-proxy/" >}}).
* **Remote JSON Web Key Set (JWKS) fetches**: In Kubernetes, the control plane fetches remote JWKS, not the agentgateway proxy, so the callout proxy settings have no effect on these fetches. To send a JWKS fetch through a forward proxy, set the `tunnel` policy on the {{< reuse "agw-docs/snippets/backend.md" >}} that serves the JWKS.

## Configure the callout proxy

You configure the callout proxy on the agentgateway proxy deployment through an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, in either of the following ways. If you use both, `config.callouts.tunnel` takes precedence, and the agentgateway proxy ignores the proxy environment variables for callouts.

* **[With environment variables](#environment-variables)**: Set the standard proxy environment variables, such as `HTTPS_PROXY`, in `spec.env`. Use this configuration for most setups. Note that this configuration is also the only way to send GCP credential fetches through the forward proxy.
* **[In `rawConfig`](#rawconfig)**: Set `config.callouts.tunnel` in `spec.rawConfig`. Use this way to keep the forward proxy settings separate from environment variables that other tools in the pod read. The control plane reads `rawConfig` only from an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that a Gateway references.

### Option 1: Environment variables

Set the following variables in `spec.env` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource. The agentgateway proxy reads them at startup. Uppercase names take precedence over lowercase names, such as `HTTPS_PROXY` over `https_proxy`.

| Variable | Description |
| -- | -- |
| `HTTPS_PROXY` | The forward proxy for callouts that use TLS. |
| `HTTP_PROXY` | The forward proxy for plaintext callouts. |
| `ALL_PROXY` | The forward proxy for callouts when you omit `HTTPS_PROXY` or `HTTP_PROXY`. |
| `NO_PROXY` | A comma-separated list of destinations that bypass the forward proxy. Each entry is a hostname, an IP address, a Classless Inter-Domain Routing (CIDR) range, or `*` for every destination. A hostname also matches its subdomains. |

> [!IMPORTANT]
> The proxy environment variables apply to callouts even when you set the variables for another purpose. If `spec.env` already sets `HTTPS_PROXY` for other tools, callouts also go through that forward proxy. To keep callouts direct, remove the variables from `spec.env`, or set `NO_PROXY` to `*`.

### Option 2: rawConfig

Set `config.callouts.tunnel` under `spec.rawConfig` of the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.

```yaml
apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
metadata:
  name: callout-proxy
  namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
spec:
  rawConfig:
    config:
      callouts:
        tunnel:
          url: http://proxy.example.com:3128
          noProxy:
          - internal.example.com
          - 10.0.0.0/8
```

| Setting | Description |
| -- | -- |
| `spec.rawConfig.config.callouts.tunnel.url` | The URL of the forward proxy. This forward proxy handles every callout, whether the callout uses TLS or plaintext. The scheme must be `http` or `https`. With `https`, the connection to the forward proxy uses TLS, and the forward proxy certificate is verified against the system trust bundle. If you omit the port, the default is `80` for `http` and `443` for `https`. To authenticate to the forward proxy with basic authentication, include the credentials in the URL, such as `http://user:password@proxy.example.com:3128`. |
| `spec.rawConfig.config.callouts.tunnel.noProxy` | Optional. Destinations that bypass the forward proxy, in the same syntax as `NO_PROXY`. |

## Destinations that bypass the forward proxy

The following callouts go directly to their destination, even when you configure a callout proxy.

* Callouts to a Kubernetes Service that you reference with a `Service` backendRef, such as an external authorization server in the cluster. An {{< reuse "agw-docs/snippets/backend.md" >}} with a `static` host is not a Service reference, even when the host is a cluster hostname such as `ext-authz.auth.svc.cluster.local`. Callouts to that backend go through the forward proxy, unless you add `svc.cluster.local` to `NO_PROXY` or `noProxy`.
* Destinations that match `noProxy` or `NO_PROXY`.
* Loopback and link-local IP addresses, such as `127.0.0.1` and the cloud metadata server at `169.254.169.254`. A remote forward proxy cannot reach these addresses.
* Callouts to an {{< reuse "agw-docs/snippets/backend.md" >}} that has its own `tunnel` policy. These callouts use that tunnel instead.
* GCP credential fetches, when you configure the callout proxy with `config.callouts.tunnel`. To send these fetches through a forward proxy, use the environment variables instead.

## Before you begin

{{< reuse "agw-docs/snippets/prereq.md" >}}

## Send an external authorization callout through the forward proxy

Deploy a test forward proxy, point the agentgateway proxy at it with the `HTTPS_PROXY` environment variable, and confirm that an external authorization callout goes through the forward proxy. To use `rawConfig` instead, change step 2 as that step describes. The example uses `httpbin.org` as a stand-in authorization server, because the server returns any status code that you ask for.

1. Deploy Squid as a test forward proxy. If you already have a forward proxy that the cluster can reach, skip this step and use its URL in the next step.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: v1
   kind: Namespace
   metadata:
     name: squid
   ---
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: squid
     namespace: squid
   spec:
     replicas: 1
     selector:
       matchLabels:
         app: squid
     template:
       metadata:
         labels:
           app: squid
       spec:
         containers:
         - name: squid
           image: ubuntu/squid:latest
           ports:
           - containerPort: 3128
   ---
   apiVersion: v1
   kind: Service
   metadata:
     name: squid
     namespace: squid
   spec:
     selector:
       app: squid
     ports:
     - port: 3128
       targetPort: 3128
   EOF
   kubectl rollout status deployment/squid -n squid
   ```

2. Create an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource that points callouts at the forward proxy. The external authorization callout in this guide uses TLS, so set `HTTPS_PROXY`.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/gatewayparameters.md" >}}
   metadata:
     name: callout-proxy
     namespace: {{< reuse "agw-docs/snippets/namespace.md" >}}
   spec:
     env:
     - name: HTTPS_PROXY
       value: http://squid.squid.svc.cluster.local:3128
   EOF
   ```

   To use `rawConfig` instead, replace `spec.env` with `spec.rawConfig.config.callouts.tunnel.url`, as shown in [rawConfig](#rawconfig).

3. Attach the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource to your Gateway with `infrastructure.parametersRef`. The patch keeps the rest of your Gateway as it is. If your Gateway already references an {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource, add the `spec.env` setting to that resource instead, because a Gateway references one resource only.
   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type merge \
     -p '{"spec":{"infrastructure":{"parametersRef":{"group":"{{< reuse "agw-docs/snippets/group.md" >}}","kind":"{{< reuse "agw-docs/snippets/gatewayparameters.md" >}}","name":"callout-proxy"}}}}'
   ```

4. Wait for the agentgateway proxy to roll out with the new settings.
   ```sh
   kubectl rollout status deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

5. Check the agentgateway proxy logs for the line that names the forward proxy. The label selector reads every agentgateway proxy pod, so the command also works while an old pod is still shutting down.
   ```sh
   kubectl logs -n {{< reuse "agw-docs/snippets/namespace.md" >}} -l gateway.networking.k8s.io/gateway-name=agentgateway-proxy --tail=-1 | grep "callouts will use proxy"
   ```

   Example output:
   ```console
   info	client::callout	callouts will use proxy Matcher { https: Intercept { uri: http://squid.squid.svc.cluster.local:3128/ } }
   ```

6. Create an {{< reuse "agw-docs/snippets/backend.md" >}} for the stand-in authorization server. Because the backend has a `static` host, callouts to it go through the forward proxy.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/backend.md" >}}
   metadata:
     name: httpbin-org
     namespace: httpbin
   spec:
     static:
       host: httpbin.org
       port: 443
     policies:
       tls:
         sni: httpbin.org
   EOF
   ```

7. Create an {{< reuse "agw-docs/snippets/policy.md" >}} that sends an external authorization request for every request to the httpbin route. The `/status/200` path makes `httpbin.org` allow every request. The `http.path` value is a CEL expression, so the path is a string literal in double quotes.
   ```yaml
   kubectl apply -f- <<EOF
   apiVersion: {{< reuse "agw-docs/snippets/api-version.md" >}}
   kind: {{< reuse "agw-docs/snippets/policy.md" >}}
   metadata:
     name: callout-ext-auth
     namespace: httpbin
   spec:
     targetRefs:
     - group: gateway.networking.k8s.io
       kind: HTTPRoute
       name: httpbin
     traffic:
       extAuth:
         backendRef:
           group: {{< reuse "agw-docs/snippets/group.md" >}}
           kind: {{< reuse "agw-docs/snippets/backend.md" >}}
           name: httpbin-org
         http:
           path: '"/status/200"'
   EOF
   ```

8. Send a request to the httpbin app. The request succeeds after the external authorization callout returns `200`.
   {{< tabs >}}
   {{% tab name="Cloud Provider LoadBalancer" %}}
   ```sh
   curl -i http://$INGRESS_GW_ADDRESS:80/headers -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{% tab name="Port-forward for local testing" %}}
   The rollout in step 4 replaced the agentgateway proxy pod, so start the port-forward again.
   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 8080:80 &
   curl -i localhost:8080/headers -H "host: www.example.com"
   ```
   {{% /tab %}}
   {{< /tabs >}}

   Example output:
   ```console
   HTTP/1.1 200 OK
   ```

9. Check the Squid access log for a CONNECT request to `httpbin.org:443`.
   ```sh
   kubectl exec -n squid deployment/squid -- cat /var/log/squid/access.log
   ```

   Example output:
   ```console
   1791983992.466  46059 10.244.0.19 TCP_TUNNEL/200 4933 CONNECT httpbin.org:443 - HIER_DIRECT/54.159.186.149 -
   ```

10. If the log has no CONNECT entry, restart the agentgateway proxy, and then check the log again. Squid writes the entry only when the tunnel closes, and the agentgateway proxy keeps the tunnel open to reuse it. The restart closes the tunnel.
    ```sh
    kubectl rollout restart deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
    kubectl rollout status deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
    kubectl exec -n squid deployment/squid -- cat /var/log/squid/access.log
    ```

## Cleanup

{{< reuse "agw-docs/snippets/cleanup.md" >}}

1. Delete the external authorization policy and the backend.
   ```sh
   kubectl delete {{< reuse "agw-docs/snippets/policy.md" >}} callout-ext-auth -n httpbin
   kubectl delete {{< reuse "agw-docs/snippets/backend.md" >}} httpbin-org -n httpbin
   ```

2. Remove `infrastructure.parametersRef` from your Gateway, and delete the {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} resource.
   ```sh
   kubectl patch gateway agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} --type json -p '[{"op":"remove","path":"/spec/infrastructure/parametersRef"}]'
   kubectl delete {{< reuse "agw-docs/snippets/gatewayparameters.md" >}} callout-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}}
   ```

3. Delete Squid.
   ```sh
   kubectl delete namespace squid
   ```
