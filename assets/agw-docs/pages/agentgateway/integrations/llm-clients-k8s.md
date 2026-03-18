Before configuring your AI clients, retrieve the agentgateway endpoint URL.

## Get the gateway URL

{{< tabs tabTotal="3" items="Cloud Provider LoadBalancer IP address, Cloud Provider LoadBalancer Hostname, Port-forward for local testing" >}}
{{% tab tabName="Cloud Provider LoadBalancer IP address" %}}
```sh {paths="llm-clients-k8s-gateway-url"}
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Gateway address: $INGRESS_GW_ADDRESS"
```
{{% /tab %}}
{{% tab tabName="Cloud Provider LoadBalancer Hostname" %}}
```sh
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Gateway address: $INGRESS_GW_ADDRESS"
```

{{< doc-test paths="llm-clients-k8s-gateway-url" >}}
if [ -z "${INGRESS_GW_ADDRESS}" ]; then
  echo "INGRESS_GW_ADDRESS is empty"
  exit 1
fi
{{< /doc-test >}}
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}

After port-forwarding, the gateway is accessible at `http://localhost:8080`. Use `localhost:8080` wherever the instructions reference `$INGRESS_GW_ADDRESS`.

```sh
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
```
{{% /tab %}}
{{< /tabs >}}

## Configure your client

After you have the gateway address, select a client below for configuration instructions.

{{< cards >}}
  {{< card link="cursor" title="Cursor" subtitle="AI code editor with custom model support" >}}
  {{< card link="continue" title="VS Code Continue" subtitle="Open source AI code assistant" >}}
  {{< card link="openai-sdk" title="OpenAI SDK" subtitle="Python and Node.js SDKs" >}}
  {{< card link="curl" title="curl" subtitle="Command-line HTTP client" >}}
{{< /cards >}}
