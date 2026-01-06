---
title: Deploy Binary
weight: 10
description:
---

To run agentgateway as a standalone binary, follow the steps below to download, install, and configure the binary on your local machine or server.


1. Download the agentgateway binary and install it. 
   ```sh
   curl https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/common/scripts/get-agentgateway | bash
   ```

  Alternatively, you can manually download the binary from the [agentgateway releases page](https://github.com/agentgateway/agentgateway/releases/latest).

2. Create a [configuration file](/docs/configuration/) for agentgateway. In this example, `config.yaml` is used.
    You can also start with a [simple example configuration file](https://raw.githubusercontent.com/agentgateway/agentgateway/refs/heads/main/examples/basic/config.yaml).

3. Run agentgateway:
   ```sh
   agentgateway -f config.yaml
   ```