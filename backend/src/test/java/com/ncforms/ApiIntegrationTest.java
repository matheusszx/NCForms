package com.ncforms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.NullNode;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers(disabledWithoutDocker = true)
class ApiIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");

    @Autowired
    MockMvc mvc;

    private final JsonMapper json = JsonMapper.builder().build();

    @Test
    void createPublishAnswerAndReadResponses() throws Exception {
        String token = register();
        JsonNode form = createFormWithQuestions(token);
        String formId = form.get("id").asString();
        String slug = form.get("slug").asString();
        String nameId = form.get("fields").get(1).get("id").asString();
        String colorId = form.get("fields").get(2).get("id").asString();
        String blueId = form.get("fields").get(2).get("options").get(1).get("id").asString();

        // A draft is not public yet.
        mvc.perform(get("/api/public/forms/" + slug)).andExpect(status().isNotFound());

        call(post("/api/forms/" + formId + "/publish"), token, null, 200);
        JsonNode publicForm = call(get("/api/public/forms/" + slug), null, null, 200);
        assertThat(publicForm.get("title").asString()).isEqualTo("Survey");
        assertThat(publicForm.has("id")).isFalse();

        // Missing required answer → 400 with a per-field error.
        JsonNode error = call(post("/api/public/forms/" + slug + "/responses"), null,
                Map.of("answers", Map.of(colorId, blueId)), 400);
        assertThat(error.get("fieldErrors").has(nameId)).isTrue();

        call(post("/api/public/forms/" + slug + "/responses"), null,
                Map.of("answers", Map.of(nameId, "Ana")), 201);
        call(post("/api/public/forms/" + slug + "/responses"), null,
                Map.of("answers", Map.of(nameId, "Bruno", colorId, blueId)), 201);

        JsonNode page = call(get("/api/forms/" + formId + "/responses"), token, null, 200);
        assertThat(page.get("totalItems").asInt()).isEqualTo(2);
        JsonNode newest = page.get("items").get(0);
        assertThat(newest.get("number").asInt()).isEqualTo(2);

        JsonNode detail = call(get("/api/forms/" + formId + "/responses/" + newest.get("id").asString()),
                token, null, 200);
        assertThat(detail.get("number").asInt()).isEqualTo(2);
        assertThat(detail.get("total").asInt()).isEqualTo(2);
        assertThat(detail.get("nextId").isNull()).isTrue();
        assertThat(detail.get("previousId").isNull()).isFalse();
        assertThat(detail.get("items").get(0).get("values").get(0).asString()).isEqualTo("Bruno");
        assertThat(detail.get("items").get(1).get("values").get(0).asString()).isEqualTo("Blue");

        JsonNode list = call(get("/api/forms"), token, null, 200);
        assertThat(list.get(0).get("responseCount").asInt()).isEqualTo(2);
    }

    @Test
    void removedFieldWithAnswersIsArchivedAndStillShownInResponses() throws Exception {
        String token = register();
        JsonNode form = createFormWithQuestions(token);
        String formId = form.get("id").asString();
        String slug = form.get("slug").asString();
        JsonNode nameField = form.get("fields").get(1);
        String nameId = nameField.get("id").asString();

        call(post("/api/forms/" + formId + "/publish"), token, null, 200);
        JsonNode submitted = call(post("/api/public/forms/" + slug + "/responses"), null,
                Map.of("answers", Map.of(nameId, "Carla")), 201);

        // Remove the "Name" field (which already has an answer) and keep only the section.
        JsonNode updated = call(put("/api/forms/" + formId), token, Map.of(
                "title", "Survey",
                "fields", List.of(json.convertValue(form.get("fields").get(0), Map.class))), 200);
        assertThat(updated.get("fields")).hasSize(1);

        JsonNode detail = call(get("/api/forms/" + formId + "/responses/" + submitted.get("id").asString()),
                token, null, 200);
        JsonNode item = detail.get("items").get(0);
        assertThat(item.get("archived").asBoolean()).isTrue();
        assertThat(item.get("values").get(0).asString()).isEqualTo("Carla");
    }

    @Test
    void usersCannotSeeFormsOfOthers() throws Exception {
        String owner = register();
        String intruder = register();
        String formId = createFormWithQuestions(owner).get("id").asString();

        call(get("/api/forms/" + formId), intruder, null, 404);
        call(get("/api/forms/" + formId + "/responses"), intruder, null, 404);
        assertThat(call(get("/api/forms"), intruder, null, 200)).isEmpty();
    }

    @Test
    void closedFormRejectsResponses() throws Exception {
        String token = register();
        JsonNode form = createFormWithQuestions(token);
        String formId = form.get("id").asString();
        String slug = form.get("slug").asString();

        call(post("/api/forms/" + formId + "/publish"), token, null, 200);
        call(post("/api/forms/" + formId + "/close"), token, null, 200);

        call(get("/api/public/forms/" + slug), null, null, 410);
        call(post("/api/public/forms/" + slug + "/responses"), null, Map.of("answers", Map.of()), 410);
    }

    @Test
    void protectedEndpointsRequireToken() throws Exception {
        mvc.perform(get("/api/forms")).andExpect(status().isUnauthorized());
    }

    @Test
    void loginWithWrongPasswordFails() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@test.com";
        call(post("/api/auth/register"), null, Map.of("name", "Ana", "email", email, "password", "secure-password"), 201);

        call(post("/api/auth/login"), null, Map.of("email", email, "password", "wrong1234"), 401);
        JsonNode ok = call(post("/api/auth/login"), null, Map.of("email", email.toUpperCase(), "password", "secure-password"), 200);
        assertThat(ok.get("token").asString()).isNotBlank();
    }

    private String register() throws Exception {
        String email = "user-" + UUID.randomUUID() + "@test.com";
        JsonNode auth = call(post("/api/auth/register"), null,
                Map.of("name", "Test", "email", email, "password", "secure-password"), 201);
        return auth.get("token").asString();
    }

    /** Creates a form with [section, "Name" (required), "Color" (radio Red/Blue)]. */
    private JsonNode createFormWithQuestions(String token) throws Exception {
        JsonNode created = call(post("/api/forms"), token, Map.of("title", "Survey"), 201);
        Map<String, Object> body = Map.of(
                "title", "Survey",
                "description", "Description",
                "fields", List.of(
                        Map.of("type", "SECTION_TITLE", "label", "Details"),
                        Map.of("type", "SHORT_TEXT", "label", "Name", "required", true),
                        Map.of("type", "RADIO", "label", "Color", "options",
                                List.of(Map.of("label", "Red"), Map.of("label", "Blue")))));
        return call(put("/api/forms/" + created.get("id").asString()), token, body, 200);
    }

    private JsonNode call(MockHttpServletRequestBuilder request, String token, Object body, int expectedStatus)
            throws Exception {
        if (token != null) {
            request.header("Authorization", "Bearer " + token);
        }
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        String content = mvc.perform(request)
                .andExpect(status().is(expectedStatus))
                .andReturn().getResponse().getContentAsString();
        return content.isEmpty() ? NullNode.getInstance() : json.readTree(content);
    }
}
