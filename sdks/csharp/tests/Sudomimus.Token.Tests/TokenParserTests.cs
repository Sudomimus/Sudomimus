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

        Assert.Equal("subject-1", token.Body.Subject);
        Assert.Equal("session-1", token.Body.SessionId);
        Assert.Equal("anchor-1", token.Body.Audience);
        Assert.Equal(TokenVerifier.AccessTokenType, token.Header.Type);
        Assert.Equal("RS256", token.Header.Algorithm);
    }

    [Fact]
    public void ParseRefreshToken_ReturnsTypedBodyAndHeader()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintRefreshToken(keys.PrivateKeyPem);

        var token = TokenParser.ParseRefreshToken(jwt);

        Assert.Equal("session-1", token.Body.SessionId);
        Assert.Equal(1, token.Body.RotationVersion);
        Assert.Equal(TokenVerifier.RefreshTokenType, token.Header.Type);
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

    [Fact]
    public void ParseAccessToken_PreservesRawWireString()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintAccessToken(keys.PrivateKeyPem);

        var token = TokenParser.ParseAccessToken(jwt);

        Assert.Equal(jwt, token.Raw);
    }

    [Fact]
    public void ParseAccessToken_ThrowsInvalidJwt_WhenBodyIsNotJson()
    {
        var jwt = TestHelpers.MintRaw(
            """{"alg":"RS256","typ":"JWT","kty":"Access"}""",
            "not-json");

        var ex = Assert.Throws<TokenException>(() => TokenParser.ParseAccessToken(jwt));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }

    [Fact]
    public void ParseAccessToken_ThrowsInvalidJwt_WhenBodyIsJsonNull()
    {
        var jwt = TestHelpers.MintRaw("""{"alg":"RS256","typ":"JWT","kty":"Access"}""", "null");

        var ex = Assert.Throws<TokenException>(() => TokenParser.ParseAccessToken(jwt));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }

    [Fact]
    public void PeekHeader_ReturnsExactJoseHeader()
    {
        var jwt = TestHelpers.MintRaw(
            $$"""{"alg":"RS256","typ":"{{TokenVerifier.AccessTokenType}}","kid":"key-1"}""",
            """{"sub":"subject-1"}""");

        var header = TokenParser.PeekHeader(jwt);

        Assert.Equal(TokenVerifier.AccessTokenType, header.Type);
        Assert.Equal("key-1", header.KeyId);
    }

    [Theory]
    [InlineData("")]
    [InlineData("only.two")]
    [InlineData("a.b.c.d")]
    public void PeekHeader_ThrowsInvalidJwt_OnStructuralFailures(string jwt)
    {
        var ex = Assert.Throws<TokenException>(() => TokenParser.PeekHeader(jwt));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }

    [Fact]
    public void PeekHeader_ThrowsInvalidJwt_WhenHeaderSegmentUndecodable()
    {
        var ex = Assert.Throws<TokenException>(() => TokenParser.PeekHeader("###.body.sig"));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }

    [Fact]
    public void PeekHeader_ThrowsInvalidJwt_WhenHeaderIsNotJson()
    {
        var jwt = TestHelpers.MintRaw("not-json", """{"subject":"subject-1"}""");

        var ex = Assert.Throws<TokenException>(() => TokenParser.PeekHeader(jwt));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }

    [Fact]
    public void PeekHeader_ThrowsInvalidJwt_WhenHeaderIsJsonNull()
    {
        var jwt = TestHelpers.MintRaw("null", """{"subject":"subject-1"}""");

        var ex = Assert.Throws<TokenException>(() => TokenParser.PeekHeader(jwt));
        Assert.Equal(TokenErrorCode.InvalidJwt, ex.Code);
    }
}
