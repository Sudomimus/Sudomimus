using YamlDotNet.Serialization;

namespace Sudomimus.Contract.Tests;

/// <summary>
/// Thin read-only view over one OpenAPI document in <c>specs/</c>, used by the
/// contract tests to compare the hand-written C# models against the spec that
/// is the cross-repo source of truth. Only the handful of accessors the tests
/// need are implemented; this is deliberately not a general OpenAPI parser.
/// </summary>
public sealed class SpecDocument
{
    private readonly IReadOnlyDictionary<object, object> _schemas;

    private SpecDocument(IReadOnlyDictionary<object, object> schemas) => _schemas = schemas;

    private static readonly Dictionary<string, SpecDocument> Cache = new();

    /// <summary>Load <c>{service}.yaml</c> (e.g. "connect"), cached per process.</summary>
    public static SpecDocument Load(string service)
    {
        if (Cache.TryGetValue(service, out var cached))
        {
            return cached;
        }

        var path = Path.Combine(FindSpecsDir(), $"{service}.yaml");
        var root = new DeserializerBuilder().Build()
            .Deserialize<Dictionary<object, object>>(File.ReadAllText(path));
        var components = (Dictionary<object, object>)root["components"];
        var schemas = (Dictionary<object, object>)components["schemas"];

        var doc = new SpecDocument(schemas);
        Cache[service] = doc;
        return doc;
    }

    private Dictionary<object, object> Schema(string name)
    {
        if (!_schemas.TryGetValue(name, out var schema))
        {
            throw new InvalidOperationException($"Spec schema '{name}' not found.");
        }

        return (Dictionary<object, object>)schema;
    }

    /// <summary>The property names declared on a schema's <c>properties</c> map.</summary>
    public IReadOnlySet<string> PropertyNames(string schemaName)
    {
        var schema = Schema(schemaName);
        if (!schema.TryGetValue("properties", out var props))
        {
            return new HashSet<string>();
        }

        return ((Dictionary<object, object>)props).Keys.Select(k => (string)k).ToHashSet();
    }

    /// <summary>The schema's <c>required</c> list (empty when the key is absent).</summary>
    public IReadOnlySet<string> RequiredNames(string schemaName)
    {
        var schema = Schema(schemaName);
        if (!schema.TryGetValue("required", out var required))
        {
            return new HashSet<string>();
        }

        return ((List<object>)required).Select(v => (string)v).ToHashSet();
    }

    /// <summary>The <c>enum</c> values of a string property on a schema.</summary>
    public IReadOnlySet<string> PropertyEnum(string schemaName, string propertyName)
    {
        return PropertyEnumFromSchema(Schema(schemaName), propertyName);
    }

    private HashSet<string> PropertyEnumFromSchema(
        Dictionary<object, object> schema,
        string propertyName)
    {
        var values = new HashSet<string>();

        if (schema.TryGetValue("$ref", out var reference))
        {
            values.UnionWith(PropertyEnumFromSchema(Schema(RefName((string)reference)), propertyName));
        }

        if (schema.TryGetValue("properties", out var propertiesObject))
        {
            var properties = (Dictionary<object, object>)propertiesObject;
            if (properties.TryGetValue(propertyName, out var propertyObject))
            {
                var property = (Dictionary<object, object>)propertyObject;
                if (property.TryGetValue("enum", out var enumObject))
                {
                    values.UnionWith(((List<object>)enumObject).Select(value => (string)value));
                }
            }
        }

        foreach (var compositionKey in new[] { "allOf", "oneOf", "anyOf" })
        {
            if (!schema.TryGetValue(compositionKey, out var membersObject))
            {
                continue;
            }

            foreach (var member in (List<object>)membersObject)
            {
                values.UnionWith(PropertyEnumFromSchema(
                    (Dictionary<object, object>)member,
                    propertyName));
            }
        }

        return values;
    }

    private static string RefName(string reference) => reference[(reference.LastIndexOf('/') + 1)..];

    private static string FindSpecsDir()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            if (File.Exists(Path.Combine(dir.FullName, "specs", "connect.yaml")))
            {
                return Path.Combine(dir.FullName, "specs");
            }
        }

        throw new InvalidOperationException(
            "Could not locate the specs/ directory by walking up from " + AppContext.BaseDirectory);
    }
}
