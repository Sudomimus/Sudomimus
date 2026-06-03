// `java-library` is a core Gradle plugin (always on the classpath), so it is
// not declared here with `apply false` — Gradle 8+ rejects that as an error.
// Subprojects apply it themselves; the `subprojects` block below reacts to it.

allprojects {
    group = "com.sudomimus"
    version = "0.1.0"

    repositories {
        mavenCentral()
    }
}

subprojects {
    plugins.withId("java-library") {
        extensions.configure<JavaPluginExtension> {
            toolchain {
                languageVersion.set(JavaLanguageVersion.of(17))
            }
            withSourcesJar()
            withJavadocJar()
        }

        tasks.withType<JavaCompile>().configureEach {
            options.encoding = "UTF-8"
            options.release.set(17)
        }

        tasks.withType<Test>().configureEach {
            useJUnitPlatform()
        }
    }
}
