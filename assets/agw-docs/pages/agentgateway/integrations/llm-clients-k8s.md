Before configuring your AI clients, retrieve the agentgateway endpoint URL.

## Get the gateway URL

{{< tabs tabTotal="3" items="Cloud Provider LoadBalancer,Port-forward for local testing,Ingress" >}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}

If agentgateway is exposed with a LoadBalancer service, retrieve the external IP or hostname:

```sh
# If your cloud provider assigns an IP address:
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# If your cloud provider assigns a hostname:
export INGRESS_GW_ADDRESS=$(kubectl get svc -n {{< reuse "agw-docs/snippets/namespace.md" >}} agentgateway-proxy \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Gateway address: $INGRESS_GW_ADDRESS"
```

{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}

For local testing without a LoadBalancer:

```sh
kubectl port-forward -n {{< reuse "agw-docs/snippets/namespace.md" >}} svc/agentgateway-proxy 8080:80
```

The gateway is then accessible at `http://localhost:8080`. Use `localhost:8080` wherever the instructions reference `$INGRESS_GW_ADDRESS`.

{{% /tab %}}
{{% tab tabName="Ingress" %}}

If agentgateway is exposed through an Ingress resource, retrieve the host:

```sh
kubectl get ingress -n {{< reuse "agw-docs/snippets/namespace.md" >}} \
  -o jsonpath='{.items[0].spec.rules[0].host}'
```

{{% /tab %}}
{{< /tabs >}}

## Configure your client

Once you have the gateway address, select a client below for configuration instructions.

{{< cards >}}
  {{< card link="cursor" title="Cursor" subtitle="AI code editor with custom model support" >}}
  {{< card link="continue" title="VS Code Continue" subtitle="Open source AI code assistant" >}}
  {{< card link="openai-sdk" title="OpenAI SDK" subtitle="Python and Node.js SDKs" >}}
  {{< card link="curl" title="curl" subtitle="Command-line HTTP client" >}}
{{< /cards >}}
