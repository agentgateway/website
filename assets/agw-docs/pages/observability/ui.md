## About

The agentgateway UI is a built-in web interface that runs on port 15000 of the `agentgateway-proxy` pod. In Kubernetes mode, the UI is **read-only**. It reflects the configuration that the agentgateway controller pushes to the proxy over xDS, the protocol that the control plane uses to deliver configuration to the proxy.

{{< version include-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
> [!NOTE]
> The UI is read-only in Kubernetes mode. Unlike standalone mode, you cannot use the UI to add features such as models, LLM providers, or MCP servers. The Kubernetes UI also does not currently show the standalone **LLM > Client Setup** generator. Instead, make configuration changes by updating your Kubernetes resources, such as through GitOps, and configure LLM clients with the values from their integration guides.
{{< /version >}}
{{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" >}}
> [!NOTE]
> The UI is read-only in Kubernetes mode. Unlike standalone mode, you cannot use the UI to add features such as models, LLM providers, or MCP servers. Instead, make configuration changes by updating your Kubernetes resources, such as through GitOps. To generate settings for LLM clients, use the [Client Setup](#client-setup) page, which does not change any resources.
{{< /version >}}


The UI is useful for debugging and verifying the configuration that the proxy received from the controller, such as confirming that a Gateway, HTTPRoute, AgentgatewayBackend, or AgentgatewayPolicy resource took effect.

## Access the UI {#access-admin-ui}

The UI is not exposed as a Kubernetes Service. To access it, use `kubectl port-forward` to forward the pod's port to your local machine.

1. Forward port 15000 from the `agentgateway-proxy` deployment to your local machine.

   ```sh
   kubectl port-forward deployment/agentgateway-proxy -n {{< reuse "agw-docs/snippets/namespace.md" >}} 15000
   ```

   Example output:

   ```
   Forwarding from 127.0.0.1:15000 -> 15000
   Forwarding from [::1]:15000 -> 15000
   ```

2. While the port-forward is running, open [http://localhost:15000/ui/](http://localhost:15000/ui/) in your browser.

   The **Gateway Overview** opens in read-only mode and summarizes the resources that the proxy currently serves, such as the number of listeners, routes, and policies.

   {{< reuse-image-light src="img/agentgateway-ui-kube-landing.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-ui-kube-landing-dark.png" >}}

> [!NOTE]
> The port-forward connection closes when you stop the <code>kubectl port-forward</code> command. Run it in a dedicated terminal tab or in the background if you need persistent access.

{{% version exclude-if="1.2.x,1.1.x,1.0.x,2.2.x" %}}
## Explore the read-only views {#explore}

Because configuration is managed by xDS, every page shows a read-only mode banner and editing is disabled. The views reflect the configuration that the proxy currently runs, so use them to verify that the proxy received the configuration that you expect. The navigation menu groups the views into **Gateway**, {{< version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" >}}**LLM**, {{< /version >}}**Traffic**, and **Tools**.

### Listeners {#listeners}

The **Listeners** page lists the ports that the proxy binds and the routes that are attached to each listener. Use it to confirm the proxy's port bindings and how routes map to each listener.

{{< reuse-image-light src="img/agentgateway-ui-kube-listeners.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-listeners-dark.png" >}}

### Routes {#routes}

The **Routes** page is an inventory of the routes that the proxy currently runs. Each row shows the route name, type, listener, path match, backends, and the number of attached policies. To inspect a single route in more detail, click the view (eye) icon in its row.

{{< reuse-image-light src="img/agentgateway-ui-kube-routes.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-routes-dark.png" >}}

### Policies {#policies}

The **Policies** page lists the policies that the proxy currently runs, including the resource that each policy targets, the policy type, and how the policy is inherited.

{{< reuse-image-light src="img/agentgateway-ui-kube-policies.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-policies-dark.png" >}}

### CEL Playground {#cel-playground}

The **CEL Playground**, under **Tools**, lets you evaluate Common Expression Language (CEL) expressions against sample input. The playground does not modify any configuration. For more information about where agentgateway uses CEL, see the [CEL expressions reference]({{< link-hextra path="/reference/cel/" >}}).

{{< reuse-image-light src="img/agentgateway-ui-kube-cel.png" >}}
{{< reuse-image-dark srcDark="img/agentgateway-ui-kube-cel-dark.png" >}}
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,2.2.x" %}}
### Models {#models}

The **Models** page, under **LLM**, lists the models that the proxy serves from your {{< reuse "agw-docs/snippets/agentgatewaymodel.md" >}} resources. Each row shows the model name, whether the model is concrete or virtual, its visibility, its target, and its listener. The list includes internal models. To view the YAML for a model, click the view (eye) icon in its row. For more information about models, see [About models]({{< link-hextra path="/documentation/llm/models/about/" >}}).
{{% /version %}}

{{% version exclude-if="1.0.x,1.1.x,1.2.x,1.3.x,1.4.x,1.5.x,1.6.x,2.2.x" %}}
## Generate LLM client settings {#client-setup}

Use the **LLM** > **Client Setup** page to generate connection settings and snippets for LLM clients, such as curl, Claude Code, Codex CLI, Continue, Cursor, and the OpenAI SDKs. The page configures the client only and does not create or change Gateway, HTTPRoute, AgentgatewayBackend, AgentgatewayPolicy, or Secret resources.

1. Open the **LLM** > **Client Setup** page, such as [http://localhost:15000/ui/llm/client-setup](http://localhost:15000/ui/llm/client-setup).
2. Enter the **Gateway base URL** that clients use to reach the proxy, including any route prefix. The field starts empty because the proxy does not know the external address of its Gateway, such as a load balancer hostname. The snippets appear only after you enter a URL.
3. Select a model. The list includes public concrete models and virtual models from the proxy's configuration. Internal models are not listed, because clients cannot request them directly. If the model that you want is not listed, type its name. If you select a wildcard model, such as `gpt-*`, type the rest of the model name that the client requests.
4. Enter the API key that the client sends. The UI keeps the key in the browser and does not read it from a Kubernetes Secret.
5. Select the client from the **Integration** dropdown and copy the generated settings or snippet.

For client-specific prerequisites, see [LLM clients]({{< link-hextra path="/integrations/llm/clients/" >}}).
{{% /version %}}
