using System.Text.Json.Serialization;

namespace Sudomimus.Native;

/// <summary>Complete, versioned terms returned to a Steam client for confirmation.</summary>
public sealed record NativeLegalAgreementChallenge
{
    [JsonPropertyName("documentType")]
    public required string DocumentType { get; init; }

    [JsonPropertyName("requiredRevision")]
    public required long RequiredRevision { get; init; }

    [JsonPropertyName("requiredAcceptanceEpoch")]
    public required long RequiredAcceptanceEpoch { get; init; }

    [JsonPropertyName("locales")]
    public required IReadOnlyDictionary<string, NativeLegalAgreementLocale> Locales { get; init; }
}

public sealed record NativeLegalAgreementLocale
{
    [JsonPropertyName("contentSha256")]
    public required string ContentSha256 { get; init; }

    [JsonPropertyName("versionUrl")]
    public required string VersionUrl { get; init; }

    [JsonPropertyName("document")]
    public required NativeLegalAgreementDocument Document { get; init; }
}

public sealed record NativeLegalAgreementDocument
{
    [JsonPropertyName("schemaVersion")]
    public required long SchemaVersion { get; init; }

    [JsonPropertyName("title")]
    public required string Title { get; init; }

    [JsonPropertyName("sections")]
    public required IReadOnlyList<NativeLegalAgreementSection> Sections { get; init; }
}

public sealed record NativeLegalAgreementSection
{
    [JsonPropertyName("heading")]
    public required string Heading { get; init; }

    [JsonPropertyName("paragraphs")]
    public required IReadOnlyList<string> Paragraphs { get; init; }

    [JsonPropertyName("table")]
    public NativeLegalAgreementTable? Table { get; init; }

    [JsonPropertyName("link")]
    public NativeLegalAgreementLink? Link { get; init; }
}

public sealed record NativeLegalAgreementTable
{
    [JsonPropertyName("caption")]
    public required string Caption { get; init; }

    [JsonPropertyName("columns")]
    public required IReadOnlyList<string> Columns { get; init; }

    [JsonPropertyName("rows")]
    public required IReadOnlyList<IReadOnlyList<NativeLegalAgreementCell>> Rows { get; init; }

    [JsonPropertyName("footer")]
    public required string Footer { get; init; }
}

public sealed record NativeLegalAgreementLink
{
    [JsonPropertyName("label")]
    public required string Label { get; init; }

    [JsonPropertyName("url")]
    public required string Url { get; init; }
}

public sealed record NativeLegalAgreementCell
{
    [JsonPropertyName("text")]
    public required string Text { get; init; }

    [JsonPropertyName("url")]
    public string? Url { get; init; }
}
