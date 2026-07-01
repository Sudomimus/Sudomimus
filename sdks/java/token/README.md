# sudomimus-token (Java)

Java SDK for parsing and verifying [Sudomimus](https://sudomimus.com) access and refresh JWTs.

Mirrors [`@sudomimus/token`](../../typescript/packages/token) (TypeScript) and [`Sudomimus.Token`](../../csharp/src/Sudomimus.Token) (C#). RS256 only.

## Install (Gradle, Kotlin DSL)

```kotlin
dependencies {
    implementation("com.sudomimus:sudomimus-token:0.1.0")
}
```

## Usage

```java
import com.sudomimus.token.*;

var verifier = new TokenVerifier(applicationAnchor -> {
    // Return the PEM-encoded RSA public key for this application.
    return myCache.get(applicationAnchor);
});

try {
    JwtToken<AccessTokenBody> token = verifier.verifyAccessToken(jwt);
    System.out.println(token.getBody().subject + " " + token.getBody().avatarUrl);
} catch (TokenException e) {
    // e.getCode(): INVALID_JWT | WRONG_KEY_TYPE | MISSING_AUDIENCE | EXPIRED | INVALID_SIGNATURE
}
```

The verifier performs, in order: parse → `kty` matches `"Access"`/`"Refresh"`
→ `aud` non-empty → expiration in the future → RSA-SHA256 signature against
`resolver.resolve(aud)`. The verifier does not cache resolver results.
