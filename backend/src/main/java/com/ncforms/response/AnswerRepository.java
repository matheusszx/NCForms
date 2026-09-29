package com.ncforms.response;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AnswerRepository extends JpaRepository<Answer, UUID> {

    boolean existsByFieldId(UUID fieldId);
}
