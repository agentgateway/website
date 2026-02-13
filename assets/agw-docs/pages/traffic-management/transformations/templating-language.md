The data plane proxy of your Gateway determines the templating language that you use to express transformations.



{{< icon "agentgateway" >}} Common Expression Language (CEL) for {{< reuse "agw-docs/snippets/agentgateway.md" >}}

## CEL for Agentgateway {#cel}

{{< reuse "agw-docs/snippets/agentgateway-capital.md" >}} transformation templates are written in Common Expression Language (CEL). CEL is a fast, portable, and safely executable language that goes beyond declarative configurations. CEL lets you develop more complex expressions in a readable, developer-friendly syntax.

To learn more about how to use CEL, refer to the following resources:

* [cel.dev tutorial](https://cel.dev/tutorials/cel-get-started-tutorial)
* [Agentgateway reference docs](https://agentgateway.dev/docs/standalone/latest/reference/cel/)

### Log CEL variables in agentgateway {#cel-log}

You can log the full context of the CEL variables by [upgrading your Helm installation settings]({{< link-hextra path="/operations/upgrade/">}}), such as the following example:

```yaml
agentgateway:
  config:
    logging:
      fields:
        add:
          cel: variables()
  enabled: true
```




