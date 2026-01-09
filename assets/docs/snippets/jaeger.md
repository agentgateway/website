Use [`docker compose`](https://docs.docker.com/compose/install/linux/) to spin up a Jaeger instance with the following components: 
* An OpenTelemetry collector that receives traces from the agentgateway. The collector is exposed on `http://localhost:4317`. 
* A Jaeger agent that receives the collected traces. The agent is exposed on `http://localhost:14268`. 
* A Jaeger UI that is exposed on `http://localhost:16686`. 

```sh
docker compose -f - up -d <<EOF
{{< github url="https://agentgateway.dev/examples/telemetry/docker-compose.yaml" >}}
EOF
```