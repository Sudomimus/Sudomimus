using Sudomimus.Token;
using Xunit;

namespace Sudomimus.Token.Tests;

public class IdTokenTests
{
    private static string MintIdToken(string privateKeyPem, object? bodyOverride = null)
    {
        var iat = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var header = new { alg = "RS256", typ = "JWT", kid = "platform-1" };
        var body = bodyOverride ?? new
        {
            iss = "https://oidc.sudomimus.com",
            sub = "subject-1",
            aud = "client-1",
            iat,
            exp = iat + 3600,
            email = "ada@example.com",
            email_verified = true,
            name = "Ada Lovelace",
            nonce = "n-1",
        };
        return TestHelpers.MintToken(header, body, privateKeyPem);
    }

    [Fact]
    public void Parse_ExposesBody()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var token = IdToken.Parse(MintIdToken(keys.PrivateKeyPem));

        Assert.Equal("subject-1", token.Body.Subject);
        Assert.Equal("ada@example.com", token.Body.Email);
        Assert.Equal("platform-1", token.Header.KeyId);
    }

    [Fact]
    public void Verify_HappyPath()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var token = IdToken.Verify(MintIdToken(keys.PrivateKeyPem), keys.PublicKeyPem, new IdTokenExpectations
        {
            Audience = "client-1",
            Issuer = "https://oidc.sudomimus.com",
            Nonce = "n-1",
        });

        Assert.Equal("subject-1", token.Body.Subject);
    }

    [Fact]
    public void Verify_ExpiredThrows()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var past = DateTimeOffset.UtcNow.ToUnixTimeSeconds() - 10;
        var jwt = MintIdToken(keys.PrivateKeyPem, new
        {
            iss = "https://oidc.sudomimus.com",
            sub = "subject-1",
            aud = "client-1",
            iat = past - 3600,
            exp = past,
        });

        var ex = Assert.Throws<TokenException>(() => IdToken.Verify(jwt, keys.PublicKeyPem));
        Assert.Equal(TokenErrorCode.Expired, ex.Code);
    }

    [Fact]
    public void Verify_WrongSignatureThrows()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var other = TestHelpers.GenerateRsaKeyPair();

        var ex = Assert.Throws<TokenException>(
            () => IdToken.Verify(MintIdToken(keys.PrivateKeyPem), other.PublicKeyPem));
        Assert.Equal(TokenErrorCode.InvalidSignature, ex.Code);
    }

    [Fact]
    public void Verify_WrongNonceThrows()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = MintIdToken(keys.PrivateKeyPem);

        var ex = Assert.Throws<TokenException>(
            () => IdToken.Verify(jwt, keys.PublicKeyPem, new IdTokenExpectations { Nonce = "n-2" }));
        Assert.Equal(TokenErrorCode.WrongNonce, ex.Code);
    }
}
