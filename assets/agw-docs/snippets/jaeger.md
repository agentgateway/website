Use [`docker compose`](https://docs.docker.com/compose/install/linux/) to spin up a Jaeger instance with the following components: 
* An OpenTelemetry collector that receives traces from the agentgateway and forwards them to Jaeger. The collector is exposed on `http://localhost:4317`. 
* A Jaeger agent that receives the collected traces. The agent is exposed on `http://localhost:14268`. 
* A Jaeger UI that is exposed on `http://localhost:16686`. 

Steps to create a Jaeger instance:
1. Create the OpenTelemetry collector configuration file in your current directory. The Compose file in the next step mounts this file into the collector container. Both files are sourced from the [`examples/telemetry`](https://github.com/agentgateway/agentgateway/tree/main/examples/telemetry) directory in the agentgateway repository. 

   ```sh
   cat > otel-collector-config.yaml <<'EOF'
   {{< github url="https://agentgateway.dev/examples/telemetry/otel-collector-config.yaml" >}}
   EOF
   ```

2. Spin up the Jaeger and collector containers. 

   ```sh
   docker compose -f - up -d <<EOF
   {{< github url="https://agentgateway.dev/examples/telemetry/docker-compose.yaml" >}}
   EOF
   ```