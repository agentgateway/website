---
title: CEL playground
weight: 1
description: Try out CEL expressions interactively in the agentgateway admin UI.
---

You can try out CEL expressions directly in the built-in CEL playground in the agentgateway admin UI. The playground uses agentgateway's actual CEL runtime, so custom functions and variables specific to agentgateway are available for testing.

To open the playground:

1. Run agentgateway.
   ```sh
   agentgateway -f config.yaml
   ```

2. Open the [CEL playground](http://localhost:15000/ui/cel/).

3. In the **Expression** box, enter the CEL expression that you want to test.
4. In the **Input Data (YAML)** box, paste the YAML file structure that the CEL expression is running against.
5. To test your CEL expression, click **Evaluate**.

{{< reuse-image src="img/cel-playground.png" >}}
{{< reuse-image-dark srcDark="img/cel-playground-dark.png" >}}
