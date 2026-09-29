package com.ncforms.form;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

public interface FormRepository extends JpaRepository<Form, UUID> {

    List<Form> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

    Optional<Form> findByIdAndOwnerId(UUID id, UUID ownerId);

    Optional<Form> findBySlug(String slug);

    boolean existsBySlug(String slug);
}
