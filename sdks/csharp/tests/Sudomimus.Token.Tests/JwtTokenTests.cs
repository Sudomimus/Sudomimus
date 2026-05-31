using Sudomimus.Token;
using Xunit;

namespace Sudomimus.Token.Tests;

public class JwtTokenTests
{
    private const string ValidHeader = """{"alg":"RS256","typ":"JWT","kty":"Access","aud":"anchor-1"}""";
    private const string ValidBody = """{"subject":"subject-1","firstName":"Ada"}""";

    [Fact]
    public void VerifyExpiration_ReturnsTrue_WhenExpInFuture()
    {
        var now = DateTimeOffset.UtcNow;
        var header = $$"""{"alg":"RS256","typ":"JWT","kty":"Access","aud":"anchor-1","exp":{{now.AddHours(1).ToUnixTimeSeconds()}}}""";
        var token = TokenParser.ParseAccessToken(TestHelpers.MintRaw(header, ValidBody));

        Assert.True(token.VerifyExpiration(now));
    }

    [Fact]
    public void VerifyExpiration_ReturnsFalse_WhenExpInPast()
    {
        var now = DateTimeOffset.UtcNow;
        var header = $$"""{"alg":"RS256","typ":"JWT","kty":"Access","aud":"anchor-1","exp":{{now.AddHours(-1).ToUnixTimeSeconds()}}}""";
        var token = TokenParser.ParseAccessToken(TestHelpers.MintRaw(header, ValidBody));

        Assert.False(token.VerifyExpiration(now));
    }

    [Fact]
    public void VerifyExpiration_ReturnsFalse_WhenExpClaimMissing()
    {
        var token = TokenParser.ParseAccessToken(TestHelpers.MintRaw(ValidHeader, ValidBody));

        Assert.Null(token.Header.ExpiresAt);
        Assert.False(token.VerifyExpiration(DateTimeOffset.UtcNow));
    }
}
