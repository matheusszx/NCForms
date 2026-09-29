package com.ncforms.response;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.ncforms.auth.CurrentUser;
import com.ncforms.common.PageDto;
import com.ncforms.response.ResponseDtos.ResponseDetailDto;
import com.ncforms.response.ResponseDtos.ResponseSummaryDto;

@RestController
@RequestMapping("/api/forms/{formId}/responses")
public class ResponseController {

    private final ResponseService responseService;

    public ResponseController(ResponseService responseService) {
        this.responseService = responseService;
    }

    @GetMapping
    public PageDto<ResponseSummaryDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID formId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return responseService.list(CurrentUser.id(jwt), formId, page, size);
    }

    @GetMapping("/{responseId}")
    public ResponseDetailDto get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID formId,
            @PathVariable UUID responseId) {
        return responseService.get(CurrentUser.id(jwt), formId, responseId);
    }

    @DeleteMapping("/{responseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID formId, @PathVariable UUID responseId) {
        responseService.delete(CurrentUser.id(jwt), formId, responseId);
    }
}
