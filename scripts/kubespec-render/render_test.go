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

// The whole row is the disclosure control, so a field with children must carry
// the target on its row line as well as on its type badge, and neither may
// render as already open. Rows without children must carry no target at all,
// or clicking them would try to open nothing.
func TestRowDisclosure(t *testing.T) {
	var doc yaml.Node
	err := yaml.Unmarshal([]byte(`type: object
required: [spec]
properties:
  name:
    type: string
  spec:
    type: object
    properties:
      replicas: {type: integer}
`), &doc)
	if err != nil {
		t.Fatal(err)
	}
	root := doc.Content[0]
	pm := toPropertyMapWithResolver(root, nil, &schemaResolver{root: root}, nil)
	html := renderWidget("Configuration schema", "", "", "Schema", pm, "test", nil)

	for _, want := range []string{
		// The row line opens the same container the badge does.
		`<div class="ks-row-line" id="test-node-1" data-ks-node-id="test-node-1" data-ks-path="spec" data-ks-children-target="test-node-1-children">`,
		`<button type="button" class="ks-type-toggle is-clickable" data-ks-children-target="test-node-1-children" aria-controls="test-node-1-children" aria-expanded="false">`,
	} {
		if !strings.Contains(html, want) {
			t.Errorf("missing markup: %s", want)
		}
	}

	// A leaf row must stay inert: no target, so the click only selects.
	if !strings.Contains(html, `<div class="ks-row-line" id="test-node-0" data-ks-node-id="test-node-0" data-ks-path="name">`) {
		t.Error("leaf row line gained a children target")
	}

	// No glyph column: this change deliberately adds no visual affordance.
	for _, unwanted := range []string{"ks-expander", "ks-expander-spacer"} {
		if strings.Contains(html, unwanted) {
			t.Errorf("unexpected %s in output", unwanted)
		}
	}

	// Collapsed is the initial state, checked against the tree markup alone,
	// since the stylesheet and script carry these literals for their own reasons.
	markup := html
	if i := strings.Index(markup, "</style>"); i >= 0 {
		markup = markup[i:]
	}
	if i := strings.Index(markup, "<script"); i >= 0 {
		markup = markup[:i]
	}
	if strings.Contains(markup, `aria-expanded="true"`) {
		t.Error("a row rendered as already expanded")
	}
}
