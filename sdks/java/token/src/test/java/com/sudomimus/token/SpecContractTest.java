package com.sudomimus.token;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.io.File;
import java.lang.reflect.Field;
import java.util.Iterator;
import java.util.Map;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;

/**
 * The Java SDK does not generate from the OpenAPI specs in {@code specs/} (the
 * hand-written classes read better than any generator's output — running
 * openapi-generator on these specs yields ~300-line POJOs and Gson-based oneOf
 * machinery). These tests instead make the spec earn its keep as a contract
 * oracle: each mapped schema's property set must match {@code specs/connect.yaml}.
 *
 * <p>Required-ness is not asserted here: the hand-written classes model claims
 * as plain nullable fields (Jackson leaves absent claims null), so there is no
 * required marker to compare against. The field-set check still catches the
 * high-value drift — a property added to or removed from the spec.
 */
final class SpecContractTest {

    private static JsonNode loadSchemas(String service) throws Exception {
        File dir = new File("").getAbsoluteFile();
        while (dir != null) {
            File candidate = new File(dir, "specs/" + service + ".yaml");
            if (candidate.isFile()) {
                JsonNode root = new ObjectMapper(new YAMLFactory()).readTree(candidate);
                return root.path("components").path("schemas");
            }
            dir = dir.getParentFile();
        }
        throw new IllegalStateException("Could not locate specs/" + service + ".yaml");
    }

    private static TreeSet<String> specProperties(JsonNode schemas, String schemaName) {
        JsonNode props = schemas.path(schemaName).path("properties");
        TreeSet<String> names = new TreeSet<>();
        for (Iterator<String> it = props.fieldNames(); it.hasNext(); ) {
            names.add(it.next());
        }
        return names;
    }

    private static TreeSet<String> wireFields(Class<?> type) {
        TreeSet<String> names = new TreeSet<>();
        for (Field f : type.getDeclaredFields()) {
            JsonProperty ann = f.getAnnotation(JsonProperty.class);
            names.add(ann != null ? ann.value() : f.getName());
        }
        return names;
    }

    @Test
    void modelsMatchSpec() throws Exception {
        JsonNode schemas = loadSchemas("connect");
        Map<String, Class<?>> mapping =
                Map.of(
                        "AccessTokenBody", AccessTokenBody.class,
                        "RefreshTokenBody", RefreshTokenBody.class);

        for (Map.Entry<String, Class<?>> entry : mapping.entrySet()) {
            assertEquals(
                    specProperties(schemas, entry.getKey()),
                    wireFields(entry.getValue()),
                    "Field set of " + entry.getValue().getName() + " drifted from spec schema '"
                            + entry.getKey() + "'");
        }
    }
}
