plugins {
    `java-library`
    `maven-publish`
}

description = "Parse and verify Sudomimus access and refresh JWTs (RS256)."

dependencies {
    api("com.fasterxml.jackson.core:jackson-databind:2.18.2")

    testImplementation(platform("org.junit:junit-bom:5.11.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")

    // Spec contract test: parse the OpenAPI YAML with the Jackson stack the
    // SDK already uses. Test-only — never shipped in the published artifact.
    testImplementation("com.fasterxml.jackson.dataformat:jackson-dataformat-yaml:2.18.2")
}

publishing {
    publications {
        create<MavenPublication>("maven") {
            from(components["java"])
            artifactId = "sudomimus-token"
            pom {
                name.set("Sudomimus Token")
                description.set(project.description)
                url.set("https://github.com/sudomimus/sudomimus")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/license/mit")
                    }
                }
            }
        }
    }
}
