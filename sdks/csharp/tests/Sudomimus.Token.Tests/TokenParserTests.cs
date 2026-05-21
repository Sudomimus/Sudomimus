using Sudomimus.Token;
using Xunit;

namespace Sudomimus.Token.Tests;

public class TokenParserTests
{
    [Fact]
    public void ParseAccessToken_ReturnsTypedBodyAndHeader()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintAccessToken(keys.PrivateKeyPem);

        var token = TokenParser.ParseAccessToken(jwt);

        Assert.Equal("Ada", token.Body.FirstName);
        Assert.Equal("Lovelace", token.Body.LastName);
        Assert.Equal("acct-1", token.Body.AccountIdentifier);
        Assert.Equal("Access", token.Header.KeyType);
        Assert.Equal("anchor-1", token.Header.Audience);
        Assert.Equal("RS256", token.Header.Algorithm);
    }

    [Fact]
    public void ParseRefreshToken_ReturnsTypedBodyAndHeader()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintRefreshToken(keys.PrivateKeyPem);

        var token = TokenParser.ParseRefreshToken(jwt);

        Assert.Equal("acct-1", token.Body.AccountIdentifier);
        Assert.Equal("Refresh", token.Header.KeyType);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-jwt")]
    [InlineData("only.two")]
    [InlineData("a.b.c.d")]
    public void ParseAccessToken_ThrowsInvalidJwt_OnStructuralFailures(string jwt)
    {
        var ex = Assert.Throws<TokenException>(() => TokenParser.ParseAccessToken(jwt));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }

    [Fact]
    public void ParseAccessToken_ThrowsInvalidJwt_OnGarbageSegments()
    {
        var ex = Assert.Throws<TokenException>(() => TokenParser.ParseAccessToken("###.###.###"));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }
}
