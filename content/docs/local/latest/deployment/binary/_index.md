---
title: Deploy the binary
weight: 10
description:
---

To run agentgateway as a standalone binary, follow the steps to download, install, and configure the binary on your local machine or server.


1. Download and install the agentgateway binary with the following command. Alternatively, you can manually download the binary from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases/latest). 
   
   ```sh
   curl -sSL https://agentgateway.dev/install | bash
   ```

2. Create a [configuration file]({{< link-hextra path="/configuration/" >}}) for agentgateway. In this example, `config.yaml` is used. You might start with [this simple example configuration file](https://agentgateway.dev/examples/basic/config.yaml).

3. Run agentgateway:
   ```sh
   agentgateway -f config.yaml
   ```
