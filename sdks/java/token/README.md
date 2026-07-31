# sudomimus-token (Java)

Java SDK for parsing and verifying [Sudomimus](https://sudomimus.com) access and refresh JWTs.

Mirrors [`@sudomimus/token`](../../typescript/packages/token) (TypeScript) and [`Sudomimus.Token`](../../csharp/src/Sudomimus.Token) (C#). RS256 only.

## Install (Gradle, Kotlin DSL)

```kotlin
dependencies {
    implementation("com.sudomimus:sudomimus-token:0.2.0")
}
```

## Usage

```java
import com.sudomimus.token.*;

var verifier = new TokenVerifier((applicationAnchor, keyId) -> {
    // Fetch/cache Session JWKS and return the PEM key matching keyId.
    return myCache.get(applicationAnchor, keyId);
});

try {
    JwtToken<AccessTokenBody> token = verifier.verifyAccessToken(jwt);
    System.out.println(token.getBody().subject + " " + token.getBody().staticAvatarUrl);
} catch (TokenException e) {
    // Also includes MISSING_KEY_ID / UNKNOWN_KEY_ID for JWKS selection.
}
```

The verifier performs, in order: parse → `kty` matches `"Access"`/`"Refresh"`
→ `aud` and `kid` non-empty → expiration in the future → RSA-SHA256 signature
against `resolver.resolve(aud, kid)`. `ApplicationJsonWebKey.toPublicKeyPem()`
converts Session RSA JWKs for the resolver. The verifier does not cache results.
