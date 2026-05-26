# Sudomimus Java SDK

Java SDKs for the [Sudomimus](https://sudomimus.com) authentication and authorization platform. Gradle (Kotlin DSL) multi-module project on JDK 17.

## Status

| Module | Maven coordinates | Purpose | Status |
| --- | --- | --- | --- |
| [`token`](token) | `com.sudomimus:sudomimus-token` | Parse and verify Sudomimus access / refresh JWTs | alpha |
| `connect` | `com.sudomimus:sudomimus-connect` | Token exchange (Establish / Redeem / Refresh / …) | planned |
| `native` | `com.sudomimus:sudomimus-native` | Direct-issue (Steam ticket / access key) | planned |

## Develop

This project uses the Gradle wrapper. If you haven't generated `gradlew` yet,
run once with a system Gradle 8+:

```bash
cd sdks/java
gradle wrapper --gradle-version 8.10
```

Then:

```bash
make compile-java      # ./gradlew build -x test
make test-java         # ./gradlew test
make compile-token-java
make test-token-java
```

Maven Central publishing setup is intentionally minimal for now — `maven-publish`
emits the artifacts but signing/staging is left for a follow-up.
