plugins {
    `java-library` apply false
}

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
