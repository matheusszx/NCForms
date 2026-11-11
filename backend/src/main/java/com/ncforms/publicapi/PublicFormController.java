package com.ncforms.publicapi;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ncforms.form.FormDtos.PublicFormDto;
import com.ncforms.form.FormService;
import com.ncforms.response.ResponseDtos.SubmitResponseRequest;
import com.ncforms.response.ResponseDtos.SubmitResponseResult;
import com.ncforms.response.ResponseService;

import jakarta.validation.Valid;

/** Endpoints used by respondents, without authentication. */
@RestController
@RequestMapping("/api/public/forms/{slug}")
public class PublicFormController {

    private final FormService formService;
    private final ResponseService responseService;

    public PublicFormController(FormService formService, ResponseService responseService) {
        this.formService = formService;
        this.responseService = responseService;
    }

    @GetMapping
    public PublicFormDto get(@PathVariable String slug) {
        return formService.getPublic(slug);
    }

    @PostMapping("/responses")
    @ResponseStatus(HttpStatus.CREATED)
    public SubmitResponseResult submit(@PathVariable String slug, @Valid @RequestBody SubmitResponseRequest request) {
        return responseService.submit(slug, request);
    }
}
