using Sudomimus.Token;
using Xunit;

namespace Sudomimus.Token.Tests;

public class JwtTokenTests
{
    private const string ValidHeader = """{"alg":"RS256","typ":"vnd.sudomimus.application-access+jwt","kid":"key-1"}""";

    [Fact]
    public void VerifyExpiration_ReturnsTrue_WhenExpInFuture()
    {
        var now = DateTimeOffset.UtcNow;
        var body = BodyWithExpiration(now.AddHours(1).ToUnixTimeSeconds());
        var token = TokenParser.ParseAccessToken(TestHelpers.MintRaw(ValidHeader, body));

        Assert.True(token.VerifyExpiration(now));
    }

    [Fact]
    public void VerifyExpiration_ReturnsFalse_WhenExpInPast()
    {
        var now = DateTimeOffset.UtcNow;
        var body = BodyWithExpiration(now.AddHours(-1).ToUnixTimeSeconds());
        var token = TokenParser.ParseAccessToken(TestHelpers.MintRaw(ValidHeader, body));

        Assert.False(token.VerifyExpiration(now));
    }

    [Fact]
    public void ParseAccessToken_RejectsMissingExpClaim()
    {
        const string body = """{"iss":"https://connect-api.sudomimus.com","aud":"anchor-1","sub":"subject-1","sid":"session-1","jti":"access-1","iat":1}""";

        Assert.Throws<TokenException>(() => TokenParser.ParseAccessToken(TestHelpers.MintRaw(ValidHeader, body)));
    }

    private static string BodyWithExpiration(long exp) =>
        $$"""{"iss":"https://connect-api.sudomimus.com","aud":"anchor-1","sub":"subject-1","sid":"session-1","jti":"access-1","iat":1,"exp":{{exp}}}""";
}
