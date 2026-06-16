You can use the pre-built Grafana dashboards to observe the control and data plane statuses. 

1. Create a Grafana dashboard for the control metrics. You can download the following sample Grafana dashboard configuration: 
   * [Agentgateway dashboard](https://github.com/agentgateway/website/blob/main/content/docs/kubernetes/main/observability/agentgateway.json)
     ```sh {paths="otel-stack"}
     curl -L "https://agentgateway.dev/docs/kubernetes/main/observability/agentgateway.json" >> agentgateway.json 
     ```

2. Import the Grafana dashboard.
   ```sh {paths="otel-stack"}
   kubectl -n telemetry create cm agentgateway-dashboard \
   --from-file=agentgateway.json
   kubectl label -n telemetry cm agentgateway-dashboard grafana_dashboard=1
   ```

3. Open and log in to Grafana by using the username `admin` and password `prom-operator`. 
      
   {{< tabs items="Cloud Provider LoadBalancer,Port-forward for local testing" tabTotal="2">}}
{{% tab tabName="Cloud Provider LoadBalancer" %}}
```sh
open "http://$(kubectl -n telemetry get svc kube-prometheus-stack-grafana -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}"):3000"
```
{{% /tab %}}
{{% tab tabName="Port-forward for local testing" %}}
1. Port-forward the Grafana service to your local machine.
   ```sh
   kubectl port-forward deployment/kube-prometheus-stack-grafana -n telemetry 3000
   ```
2. Open Grafana in your browser by using the following URL: [http://localhost:3000](http://localhost:3000)
{{% /tab %}}
   {{< /tabs >}}
            
1. Go to **Dashboards** > **Agentgateway** to open the Agentgateway dashboard that you imported. Verify that you see metrics, such as the request rate by gateway, LLM token consumption, or MCP tool calls. 
      
   {{< reuse-image src="img/agentgateway-dashboard.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-dashboard.png" >}}
   
   | Section | Metric | Description |
   | -- | -- | -- |
   | Overview | Memory | The working set memory that each agentgateway proxy pod consumes. |
   | Overview | CPU | The CPU usage rate for each agentgateway proxy pod. |
   | Requests | Requests (by Pod) | The request rate that each agentgateway proxy pod handles. |
   | Requests | Requests (by Gateway) | The request rate for each gateway. |
   | Requests | Requests (by Status) | The request rate grouped by HTTP response status. |
   | Requests | Requests (by Reason) | The request rate grouped by the response reason. |
   | LLM | Token Consumption | The rate of tokens that LLM requests consume, grouped by token type, model, and gateway. |
   | LLM | Time To First Token | The time that it takes the LLM provider to return the first token of a response. |
   | LLM | Request Time | The total duration of LLM requests. |
   | LLM | Tokens Per Second | The rate at which the LLM provider returns output tokens. |
   | MCP | MCP Calls (by method) | The rate of MCP requests grouped by JSON-RPC method. |
   | MCP | Tool Calls (by tool) | The rate of MCP tool calls grouped by server, resource, and tool. |
