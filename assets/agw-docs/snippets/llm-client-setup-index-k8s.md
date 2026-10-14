## Generate client settings

{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
The agentgateway UI includes an **LLM > Client Setup** page that generates the gateway URL, model, and credential values for these clients from the models that the proxy serves. The page does not create or change Kubernetes resources. For more information, see [Generate LLM client settings]({{< link-hextra path="/documentation/observability/ui/#client-setup" >}}).
{{< /version >}}
{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
> [!NOTE]
> The Kubernetes UI is read-only and does not currently show the standalone **LLM > Client Setup** generator. Use the client guides in this section to configure the same gateway URL, model, and credential values manually. Follow [agentgateway/agentgateway#2989](https://github.com/agentgateway/agentgateway/issues/2989) for the Client Setup enhancement.
{{< /version >}}
