package token

import (
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// The Go SDK does not generate from the OpenAPI specs in specs/ (the
// hand-written structs read better than any generator's output — see the
// repo's contract-test rationale). These tests instead make the spec earn its
// keep as a contract oracle: each mapped schema's field set and required set
// must match specs/connect.yaml.
//
// "Required" maps to the struct tag convention used throughout this package:
// a spec-required field carries `json:"name"` (no omitempty); a spec-optional
// field carries `json:"name,omitempty"`.

type specSchema struct {
	Properties map[string]yaml.Node `yaml:"properties"`
	Required   []string             `yaml:"required"`
}

type specDoc struct {
	Components struct {
		Schemas map[string]specSchema `yaml:"schemas"`
	} `yaml:"components"`
}

func loadSpec(t *testing.T, service string) specDoc {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("getwd: %v", err)
	}
	for {
		candidate := filepath.Join(dir, "specs", service+".yaml")
		if _, statErr := os.Stat(candidate); statErr == nil {
			data, readErr := os.ReadFile(candidate)
			if readErr != nil {
				t.Fatalf("read spec: %v", readErr)
			}
			var doc specDoc
			if unmarshalErr := yaml.Unmarshal(data, &doc); unmarshalErr != nil {
				t.Fatalf("unmarshal spec: %v", unmarshalErr)
			}
			return doc
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatalf("could not locate specs/%s.yaml walking up from working dir", service)
		}
		dir = parent
	}
}

// wireFields returns wireName -> isRequired for a struct type, where required
// means the json tag has no `omitempty` option.
func wireFields(t reflect.Type) map[string]bool {
	out := map[string]bool{}
	for i := 0; i < t.NumField(); i++ {
		tag := t.Field(i).Tag.Get("json")
		if tag == "" || tag == "-" {
			continue
		}
		parts := strings.Split(tag, ",")
		name := parts[0]
		hasOmitempty := false
		for _, opt := range parts[1:] {
			if opt == "omitempty" {
				hasOmitempty = true
			}
		}
		out[name] = !hasOmitempty
	}
	return out
}

func keys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func requiredKeys(m map[string]bool) []string {
	out := []string{}
	for k, req := range m {
		if req {
			out = append(out, k)
		}
	}
	sort.Strings(out)
	return out
}

func TestModelsMatchSpec(t *testing.T) {
	doc := loadSpec(t, "connect")
	cases := []struct {
		schema string
		typ    reflect.Type
	}{
		{"AccessTokenBody", reflect.TypeOf(AccessTokenBody{})},
		{"RefreshTokenBody", reflect.TypeOf(RefreshTokenBody{})},
	}

	for _, tc := range cases {
		t.Run(tc.schema, func(t *testing.T) {
			schema, ok := doc.Components.Schemas[tc.schema]
			if !ok {
				t.Fatalf("spec schema %q not found", tc.schema)
			}

			specProps := []string{}
			for name := range schema.Properties {
				specProps = append(specProps, name)
			}
			sort.Strings(specProps)

			fields := wireFields(tc.typ)

			if got := keys(fields); !reflect.DeepEqual(got, specProps) {
				t.Errorf("field set drifted from spec %q\n  spec:   %v\n  struct: %v", tc.schema, specProps, got)
			}

			specRequired := append([]string{}, schema.Required...)
			sort.Strings(specRequired)
			if got := requiredKeys(fields); !reflect.DeepEqual(got, specRequired) {
				t.Errorf("required set drifted from spec %q (json `omitempty` convention)\n  spec-required:   %v\n  struct-required: %v",
					tc.schema, specRequired, got)
			}
		})
	}
}
