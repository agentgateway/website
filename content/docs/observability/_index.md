---
title: Observability
weight: 70
description: 
---

PAGE IN PROGRESS

1. Create a configuration file for your agentproxy. In this example, you configure the following elements: 
   * **Listener**: An SSE listener that listens for incoming traffic on port 3000. The listener requires a JWT to be present in an `Authorization` header that can be validated by using a local JWT public key file. 
   * **Target**: The agentproxy targets a sample, open source MCP test server, `server-everything`. 
   * **Metrics**: The agentproxy 