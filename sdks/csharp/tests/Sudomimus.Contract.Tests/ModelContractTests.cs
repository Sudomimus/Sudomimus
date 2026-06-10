using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text.Json.Serialization;
using Xunit;

namespace Sudomimus.Contract.Tests;

/// <summary>
/// Guards the hand-written C# models against drift from the OpenAPI specs in
/// <c>specs/</c>. The C# SDKs do not generate from the spec (the idiomatic
/// hand-written records — <c>sealed record</c> + <c>required</c> + native
/// <see cref="JsonPolymorphicAttribute"/> — read better than any generator's
/// output), so these tests make the spec earn its keep as a contract oracle
/// instead: every mapped schema's property set, required set, and string
/// enums must match the corresponding C# type.
///
/// Scope: flat request/response DTOs and the token bodies, plus the string
/// "const class" enums. The <c>oneOf</c> discriminated unions
/// (ReturnMethodDeclaration, StatusPollResponse, the auth/realize payload
/// unions) intentionally diverge in shape from the spec and are reviewed by
/// hand; they are out of scope for this prototype.
/// </summary>
public sealed class ModelContractTests
{
    public static TheoryData<string, string, Type> MappedSchemas() => new()
    {
        // ---- Connect: token bodies (live in Sudomimus.Token) ----
        { "connect", "AccessTokenBody", typeof(Token.AccessTokenBody) },
        { "connect", "RefreshTokenBody", typeof(Token.RefreshTokenBody) },

        // ---- Connect: flat request/response DTOs ----
        { "connect", "HealthResponse", typeof(Connect.HealthResponse) },
        { "connect", "EstablishRequest", typeof(Connect.EstablishRequest) },
        { "connect", "EstablishResponse", typeof(Connect.EstablishResponse) },
        { "connect", "StatusPollRequest", typeof(Connect.StatusPollRequest) },
        { "connect", "RedeemRequest", typeof(Connect.RedeemRequest) },
        { "connect", "RedeemResponse", typeof(Connect.RedeemResponse) },
        { "connect", "RefreshRequest", typeof(Connect.RefreshRequest) },
        { "connect", "RefreshResponse", typeof(Connect.RefreshResponse) },
        { "connect", "InfoRequest", typeof(Connect.InfoRequest) },
        { "connect", "InfoResponse", typeof(Connect.InfoResponse) },
        { "connect", "IntrospectRequest", typeof(Connect.IntrospectRequest) },
        { "connect", "IntrospectResponse", typeof(Connect.IntrospectResponse) },
        { "connect", "LogoutRequest", typeof(Connect.LogoutRequest) },
        { "connect", "LogoutResponse", typeof(Connect.LogoutResponse) },
        { "connect", "RevokeAllRequest", typeof(Connect.RevokeAllRequest) },
        { "connect", "RevokeAllResponse", typeof(Connect.RevokeAllResponse) },

        // ---- Connect: claims view (carried on redeem / refresh) ----
        { "connect", "ClaimRequirementStateView", typeof(Connect.ClaimRequirementStateView) },
        { "connect", "ClaimsStateView", typeof(Connect.ClaimsStateView) },

        // ---- Native: direct-issue DTOs ----
        { "native", "DirectIssueAccessKeyRequest", typeof(Native.DirectIssueAccessKeyRequest) },
        { "native", "DirectIssueAccessKeyResponse", typeof(Native.DirectIssueAccessKeyResponse) },
        { "native", "DirectIssueSteamTicketRequest", typeof(Native.DirectIssueSteamTicketRequest) },
        { "native", "DirectIssueSteamTicketResponse", typeof(Native.DirectIssueSteamTicketResponse) },

        // ---- Native: claims view + errand handoff ----
        { "native", "ClaimRequirementStateView", typeof(Native.ClaimRequirementStateView) },
        { "native", "ClaimsStateView", typeof(Native.ClaimsStateView) },
        { "native", "ErrandHandoff", typeof(Native.ErrandHandoff) },
        { "native", "ErrandStatusResponse", typeof(Native.ErrandStatusResponse) },
    };

    [Theory]
    [MemberData(nameof(MappedSchemas))]
    public void Model_property_set_matches_spec(string service, string schemaName, Type type)
    {
        var specProps = SpecDocument.Load(service).PropertyNames(schemaName);
        var clrProps = WireProperties(type).Keys.ToHashSet();

        var missingInClr = specProps.Except(clrProps).OrderBy(x => x).ToList();
        var extraInClr = clrProps.Except(specProps).OrderBy(x => x).ToList();

        Assert.True(
            missingInClr.Count == 0 && extraInClr.Count == 0,
            $"{type.FullName} drifted from spec schema '{schemaName}'.\n"
                + $"  Missing in C# (present in spec): [{string.Join(", ", missingInClr)}]\n"
                + $"  Extra in C# (absent from spec):  [{string.Join(", ", extraInClr)}]");
    }

    [Theory]
    [MemberData(nameof(MappedSchemas))]
    public void Model_required_set_matches_spec(string service, string schemaName, Type type)
    {
        var specRequired = SpecDocument.Load(service).RequiredNames(schemaName);
        var clrRequired = WireProperties(type)
            .Where(kv => kv.Value)
            .Select(kv => kv.Key)
            .ToHashSet();

        var shouldBeRequired = specRequired.Except(clrRequired).OrderBy(x => x).ToList();
        var shouldBeOptional = clrRequired.Except(specRequired).OrderBy(x => x).ToList();

        Assert.True(
            shouldBeRequired.Count == 0 && shouldBeOptional.Count == 0,
            $"{type.FullName} required-ness drifted from spec schema '{schemaName}'.\n"
                + $"  Spec-required but optional in C#: [{string.Join(", ", shouldBeRequired)}]\n"
                + $"  Required in C# but optional in spec: [{string.Join(", ", shouldBeOptional)}]");
    }

    public static TheoryData<string, string, string, Type> MappedEnums() => new()
    {
        { "connect", "AuthenticationRuleConstraint", "method", typeof(Connect.AuthenticationMethod) },
        { "connect", "IntrospectResponse", "status", typeof(Connect.IntrospectStatus) },
        { "connect", "ClaimRequirementStateView", "requirement", typeof(Connect.ClaimRequirement) },
        { "connect", "ClaimRequirementStateView", "state", typeof(Connect.ClaimGrantState) },
        { "native", "ClaimRequirementStateView", "requirement", typeof(Native.ClaimRequirement) },
        { "native", "ClaimRequirementStateView", "state", typeof(Native.ClaimGrantState) },
        { "native", "ErrandStatusResponse", "status", typeof(Native.ErrandStatus) },
    };

    [Theory]
    [MemberData(nameof(MappedEnums))]
    public void Enum_values_match_spec(string service, string schemaName, string property, Type constClass)
    {
        var specValues = SpecDocument.Load(service).PropertyEnum(schemaName, property);
        var clrValues = StringConstants(constClass);

        var missingInClr = specValues.Except(clrValues).OrderBy(x => x).ToList();
        var extraInClr = clrValues.Except(specValues).OrderBy(x => x).ToList();

        Assert.True(
            missingInClr.Count == 0 && extraInClr.Count == 0,
            $"{constClass.FullName} drifted from spec enum '{schemaName}.{property}'.\n"
                + $"  Missing in C# (present in spec): [{string.Join(", ", missingInClr)}]\n"
                + $"  Extra in C# (absent from spec):  [{string.Join(", ", extraInClr)}]");
    }

    /// <summary>Map of wire name -> isRequired for every public instance property.</summary>
    private static Dictionary<string, bool> WireProperties(Type type) =>
        type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .ToDictionary(WireName, IsRequired);

    private static string WireName(PropertyInfo p) =>
        p.GetCustomAttribute<JsonPropertyNameAttribute>()?.Name ?? p.Name;

    private static bool IsRequired(PropertyInfo p) =>
        p.GetCustomAttribute<RequiredMemberAttribute>() is not null;

    private static HashSet<string> StringConstants(Type constClass) =>
        constClass.GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f is { IsLiteral: true } && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToHashSet();
}
