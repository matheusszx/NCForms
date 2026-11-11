package com.ncforms.response;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResponseRepository extends JpaRepository<Response, UUID> {

    long countByFormId(UUID formId);

    Page<Response> findByFormId(UUID formId, Pageable pageable);

    Optional<Response> findByIdAndFormId(UUID id, UUID formId);

    @Query("select r.formId as formId, count(r) as total from Response r where r.formId in :formIds group by r.formId")
    List<FormResponseCount> countByFormIds(@Param("formIds") Collection<UUID> formIds);

    /** Number of responses submitted before the given one (chronological order, ties broken by id). */
    @Query(value = """
            select count(*) from responses
            where form_id = :formId and (submitted_at, id) < (:submittedAt, :id)
            """, nativeQuery = true)
    long countBefore(@Param("formId") UUID formId, @Param("submittedAt") Instant submittedAt, @Param("id") UUID id);

    @Query(value = """
            select id from responses
            where form_id = :formId and (submitted_at, id) < (:submittedAt, :id)
            order by submitted_at desc, id desc limit 1
            """, nativeQuery = true)
    Optional<UUID> findPreviousId(@Param("formId") UUID formId, @Param("submittedAt") Instant submittedAt,
            @Param("id") UUID id);

    @Query(value = """
            select id from responses
            where form_id = :formId and (submitted_at, id) > (:submittedAt, :id)
            order by submitted_at asc, id asc limit 1
            """, nativeQuery = true)
    Optional<UUID> findNextId(@Param("formId") UUID formId, @Param("submittedAt") Instant submittedAt,
            @Param("id") UUID id);

    interface FormResponseCount {
        UUID getFormId();

        long getTotal();
    }
}
