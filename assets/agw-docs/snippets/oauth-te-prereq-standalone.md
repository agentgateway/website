The following examples run against local Keycloak stacks from the agentgateway repository. Make sure that you have the following tools installed:

- [agentgateway]({{< link path="/documentation/setup/install/" >}})
- [Docker](https://docs.docker.com/get-started/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- [`jq`](https://jqlang.org/) for reading token responses
- A local clone of the [agentgateway repository](https://github.com/agentgateway/agentgateway), which contains the example stacks:

  ```sh
  git clone https://github.com/agentgateway/agentgateway.git
  cd agentgateway
  ```
