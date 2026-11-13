Import model costs

### Synopsis

Import a model cost catalog.

Examples:
	agctl costs import > catalog.json
	agctl costs import --out ./costs/catalog.json
	agctl costs import --source models.dev --providers anthropic,google,openai

```
agctl costs import [flags]
```

### Options

```
  -h, --help                help for import
      --legacy              include deprecated models
  -o, --out string          output catalog path (default: stdout)
      --pretty              pretty-print the output JSON
      --providers strings   source provider ids to import (default: every provider the proxy supports)
      --source string       import source (models.dev) (default "models.dev")
```

### Options inherited from parent commands

```
  -k, --kubeconfig string   kubeconfig
```

### SEE ALSO

* [agctl costs](../agctl-costs/)	 - Manage model cost catalogs

