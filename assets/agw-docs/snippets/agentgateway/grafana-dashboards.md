You can use the pre-built Grafana dashboards to observe the control and data plane statuses. 

1. Download the agentgateway Grafana dashboard. This dashboard is maintained in the [agentgateway repository](https://github.com/agentgateway/agentgateway/blob/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json) and monitors both the control and data planes.
   ```sh {paths="otel-stack"}
   curl -L "https://raw.githubusercontent.com/agentgateway/agentgateway/main/controller/install/helm/agentgateway/files/agentgateway-dashboard.json" -o agentgateway.json
   ```

2. Import the Grafana dashboard.
   ```sh {paths="otel-stack"}
   kubectl -n telemetry create cm agentgateway-dashboard \
   --from-file=agentgateway.json
   kubectl label -n telemetry cm agentgateway-dashboard grafana_dashboard=1
   ```

   {{< doc-test paths="otel-stack" >}}
   # Give the Grafana sidecar time to detect the labeled configmap and import the dashboard
   # into Grafana before the next assertion queries for it.
   sleep 45
   {{< /doc-test >}}

   {{< doc-test paths="otel-stack" >}}
   YAMLTest -f - <<'EOF'
   # Confirm that Grafana loaded the imported Agentgateway dashboard. This validates the import
   # steps above (configmap -> Grafana sidecar). It does NOT verify that individual panels render
   # or return data. The Authorization header is "admin:prom-operator" (the default Grafana
   # credentials documented in this guide) base64-encoded for HTTP basic auth.
   - name: Agentgateway dashboard is loaded in Grafana
     retries: 30
     http:
       url: "http://localhost:3000/api/dashboards/uid/agentgateway"
       method: GET
       headers:
         authorization: "Basic YWRtaW46cHJvbS1vcGVyYXRvcg=="
     source:
       type: pod
       usePortForward: true
       selector:
         kind: Deployment
         metadata:
           namespace: telemetry
           name: kube-prometheus-stack-grafana
     expect:
       statusCode: 200
       bodyJsonPath:
         - path: "$.dashboard.title"
           comparator: contains
           value: Agentgateway
   EOF
   {{< /doc-test >}}

3. Open and log in to Grafana by using the username `admin` and password `prom-operator`. 
      
   {{< tabs >}}
{{% tab name="Cloud Provider LoadBalancer" %}}
```sh
open "http://$(kubectl -n telemetry get svc kube-prometheus-stack-grafana -o jsonpath="{.status.loadBalancer.ingress[0]['hostname','ip']}"):3000"
```
{{% /tab %}}
{{% tab name="Port-forward for local testing" %}}
1. Port-forward the Grafana service to your local machine.
   ```sh
   kubectl port-forward deployment/kube-prometheus-stack-grafana -n telemetry 3000
   ```
2. Open Grafana in your browser by using the following URL: [http://localhost:3000](http://localhost:3000)
{{% /tab %}}
   {{< /tabs >}}
            
4. Go to **Dashboards** > **Agentgateway** to open the Agentgateway dashboard that you imported. Verify that you see metrics, such as the proxy overview of CPU and memory usage, request rate by gateway, LLM token consumption, or MCP tool calls. 
      
   {{< reuse-image-light src="img/agentgateway-dashboard.png" >}}
   {{< reuse-image-dark srcDark="img/agentgateway-dashboard.png" >}}
   
   {{< reuse "agw-docs/snippets/agentgateway/grafana-dashboard-metrics.md" >}}
