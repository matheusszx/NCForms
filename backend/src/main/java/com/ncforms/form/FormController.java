package com.ncforms.form;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ncforms.auth.CurrentUser;
import com.ncforms.form.FormDtos.CreateFormRequest;
import com.ncforms.form.FormDtos.FormDetailDto;
import com.ncforms.form.FormDtos.FormSummaryDto;
import com.ncforms.form.FormDtos.FormUpdateRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/forms")
public class FormController {

    private final FormService formService;

    public FormController(FormService formService) {
        this.formService = formService;
    }

    @GetMapping
    public List<FormSummaryDto> list(@AuthenticationPrincipal Jwt jwt) {
        return formService.list(CurrentUser.id(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FormDetailDto create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody(required = false) CreateFormRequest request) {
        return formService.create(CurrentUser.id(jwt), request);
    }

    @GetMapping("/{id}")
    public FormDetailDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return formService.get(CurrentUser.id(jwt), id);
    }

    @PutMapping("/{id}")
    public FormDetailDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody FormUpdateRequest request) {
        return formService.update(CurrentUser.id(jwt), id, request);
    }

    @PostMapping("/{id}/publish")
    public FormDetailDto publish(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return formService.publish(CurrentUser.id(jwt), id);
    }

    @PostMapping("/{id}/close")
    public FormDetailDto close(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return formService.close(CurrentUser.id(jwt), id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        formService.delete(CurrentUser.id(jwt), id);
    }
}
