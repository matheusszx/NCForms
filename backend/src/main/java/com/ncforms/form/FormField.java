package com.ncforms.form;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "form_fields")
public class FormField {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "form_id", nullable = false)
    private Form form;

    @Column(nullable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FieldType type;

    @Column(nullable = false, length = 500)
    private String label;

    @Column(name = "help_text", columnDefinition = "text")
    private String helpText;

    @Column(nullable = false)
    private boolean required;

    /** Type-specific settings (placeholder, min, max, maxLength, scale labels...). */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> config = new HashMap<>();

    @Column(nullable = false)
    private boolean archived;

    @OneToMany(mappedBy = "field", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<FieldOption> options = new ArrayList<>();

    protected FormField() {
    }

    public FormField(FieldType type) {
        this.type = type;
    }

    public List<FieldOption> getActiveOptions() {
        return options.stream().filter(o -> !o.isArchived()).toList();
    }

    public void addOption(FieldOption option) {
        option.setField(this);
        options.add(option);
    }

    public void removeOption(FieldOption option) {
        options.remove(option);
        option.setField(null);
    }

    public UUID getId() {
        return id;
    }

    public Form getForm() {
        return form;
    }

    void setForm(Form form) {
        this.form = form;
    }

    public int getPosition() {
        return position;
    }

    public void setPosition(int position) {
        this.position = position;
    }

    public FieldType getType() {
        return type;
    }

    public void setType(FieldType type) {
        this.type = type;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getHelpText() {
        return helpText;
    }

    public void setHelpText(String helpText) {
        this.helpText = helpText;
    }

    public boolean isRequired() {
        return required;
    }

    public void setRequired(boolean required) {
        this.required = required;
    }

    public Map<String, Object> getConfig() {
        return config == null ? Map.of() : config;
    }

    public void setConfig(Map<String, Object> config) {
        this.config = config == null ? new HashMap<>() : new HashMap<>(config);
    }

    public boolean isArchived() {
        return archived;
    }

    public void setArchived(boolean archived) {
        this.archived = archived;
    }

    public List<FieldOption> getOptions() {
        return options;
    }
}
