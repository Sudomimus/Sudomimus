using System.Text;
using System.Text.Json;
using Sudomimus.Token;
using Xunit;

namespace Sudomimus.Token.Tests;

public class TokenVerifierTests
{
    private static TokenVerifier MakeVerifier(string publicKeyPem, DateTimeOffset? now = null)
    {
        var clock = now is { } fixed_ ? () => fixed_ : (Func<DateTimeOffset>)(() => DateTimeOffset.UtcNow);
        return new TokenVerifier((_, _) => Task.FromResult(publicKeyPem), clock);
    }

    [Fact]
    public async Task VerifyAccessTokenAsync_RoundTrips_WithValidKeyPair()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintAccessToken(keys.PrivateKeyPem);

        var verifier = MakeVerifier(keys.PublicKeyPem);
        var token = await verifier.VerifyAccessTokenAsync(jwt);

        Assert.Equal("subject-1", token.Body.Subject);
        Assert.Equal("Ada", token.Body.FirstName);
    }

    [Fact]
    public async Task VerifyAccessTokenAsync_ThrowsWrongKeyType_OnRefreshToken()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintRefreshToken(keys.PrivateKeyPem);

        var verifier = MakeVerifier(keys.PublicKeyPem);
        var ex = await Assert.ThrowsAsync<TokenException>(() => verifier.VerifyAccessTokenAsync(jwt));

        Assert.Equal(TokenErrorCode.WrongKeyType, ex.Code);
    }

    [Fact]
    public async Task VerifyRefreshTokenAsync_RoundTrips()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintRefreshToken(keys.PrivateKeyPem);

        var verifier = MakeVerifier(keys.PublicKeyPem);
        var token = await verifier.VerifyRefreshTokenAsync(jwt);

        Assert.Equal("subject-1", token.Body.Subject);
    }

    [Fact]
    public async Task VerifyAccessTokenAsync_ThrowsInvalidSignature_WhenPublicKeyDoesNotMatch()
    {
        var signingKeys = TestHelpers.GenerateRsaKeyPair();
        var unrelatedKeys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintAccessToken(signingKeys.PrivateKeyPem);

        var verifier = MakeVerifier(unrelatedKeys.PublicKeyPem);
        var ex = await Assert.ThrowsAsync<TokenException>(() => verifier.VerifyAccessTokenAsync(jwt));

        Assert.Equal(TokenErrorCode.InvalidSignature, ex.Code);
    }

    [Fact]
    public async Task VerifyAccessTokenAsync_ThrowsExpired_WhenClockIsPastExp()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintAccessToken(keys.PrivateKeyPem);

        // The fixture mints with exp = iat + 3600. Advance the clock past that.
        var future = DateTimeOffset.UtcNow.AddSeconds(7200);
        var verifier = MakeVerifier(keys.PublicKeyPem, future);

        var ex = await Assert.ThrowsAsync<TokenException>(() => verifier.VerifyAccessTokenAsync(jwt));
        Assert.Equal(TokenErrorCode.Expired, ex.Code);
    }

    [Fact]
    public async Task VerifyAccessTokenAsync_ThrowsMissingAudience_WhenHeaderHasNoAud()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        // Mint a token with no aud claim.
        var header = new { alg = "RS256", typ = "JWT", iat = 0, exp = long.MaxValue, kty = "Access" };
        var body = new { subject = "subject-1", firstName = "Ada" };
        var jwt = TestHelpers.MintToken(header, body, keys.PrivateKeyPem);

        var verifier = MakeVerifier(keys.PublicKeyPem);
        var ex = await Assert.ThrowsAsync<TokenException>(() => verifier.VerifyAccessTokenAsync(jwt));

        Assert.Equal(TokenErrorCode.MissingAudience, ex.Code);
    }

    [Fact]
    public async Task VerifyAccessTokenAsync_PassesAudienceToResolver()
    {
        var keys = TestHelpers.GenerateRsaKeyPair();
        var jwt = TestHelpers.MintAccessToken(keys.PrivateKeyPem, applicationAnchor: "anchor-zzz");

        string? observedAnchor = null;
        var verifier = new TokenVerifier((anchor, _) =>
        {
            observedAnchor = anchor;
            return Task.FromResult(keys.PublicKeyPem);
        });

        await verifier.VerifyAccessTokenAsync(jwt);
        Assert.Equal("anchor-zzz", observedAnchor);
    }
}
