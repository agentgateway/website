You can use the pre-built Grafana dashboards to observe the control and data plane statuses. 

1. Create a Grafana dashboard for the control metrics. Download the dashboard JSON for your current docs version:
   * [Agentgateway dashboard](agentgateway.json)

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
            
1. Go to **Dashboards** > **Agentgateway** to open the Agentgateway dashboard that you imported. Verify that panel data is being populated for your Agentgateway control plane and gateway traffic metrics.
      
   {{< reuse-image src="img/agentgateway-dashboard.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-dashboard.png" >}}
   
