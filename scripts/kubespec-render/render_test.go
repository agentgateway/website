package main

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestObjectUnionLocations(t *testing.T) {
	for _, union := range []string{"oneOf", "anyOf"} {
		t.Run(union, func(t *testing.T) {
			var doc yaml.Node
			err := yaml.Unmarshal([]byte(`type: object
properties:
  location:
    description: Credential location
    anyOf:
      - $ref: '#/$defs/Location'
      - type: 'null'
$defs:
  Location:
    UNION:
      - type: object
        description: Read a header
        required: [header]
        properties:
          header:
            type: object
            required: [name]
            properties:
              name: {type: string}
              prefix: {type: string}
      - type: object
        description: Read a query parameter
        required: [queryParameter]
        properties:
          queryParameter:
            type: object
            required: [name]
            properties:
              name: {type: string}
      - type: object
        required: [cookie]
        properties:
          cookie: {type: string}
      - type: object
        required: [expression]
        properties:
          expression: {type: string}
`), &doc)
			if err != nil {
				t.Fatal(err)
			}
			root := doc.Content[0]
			// Switch the inner union while retaining the nullable outer anyOf.
			defs := getNode(decodeMapping(root), "$defs")
			location := getNode(decodeMapping(defs), "Location")
			location.Content[0].Value = union
			pm := toPropertyMapWithResolver(root, nil, &schemaResolver{root: root}, nil)
			loc := pm.props["location"]
			if loc.description != "Credential location" {
				t.Fatalf("description: %q", loc.description)
			}
			if loc.definition == nil || strings.Join(loc.definition.keys, ",") != "header,queryParameter,cookie,expression" {
				t.Fatalf("missing union variants: %+v", loc.definition)
			}
			for name, prop := range loc.definition.props {
				if prop.required {
					t.Errorf("alternative %s marked required", name)
				}
			}
			header := loc.definition.props["header"]
			if header.description != "Read a header" || !header.definition.props["name"].required || header.definition.props["prefix"].required {
				t.Fatalf("lost variant metadata: %+v", header)
			}
			html := renderWidget("Configuration schema", "", "", "Schema", pm, "test", nil)
			for _, name := range []string{"header.name", "queryParameter.name", "cookie", "expression"} {
				if !strings.Contains(html, `data-ks-path="location.`+name+`"`) {
					t.Errorf("missing rendered path %s", name)
				}
			}
		})
	}
}
