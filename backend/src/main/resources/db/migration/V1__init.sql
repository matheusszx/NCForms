create table users (
    id            uuid primary key,
    name          varchar(120) not null,
    email         varchar(255) not null unique,
    password_hash varchar(100) not null,
    created_at    timestamptz  not null
);

create table forms (
    id          uuid primary key,
    owner_id    uuid         not null references users (id) on delete cascade,
    title       varchar(200) not null,
    description text,
    slug        varchar(32)  not null unique,
    status      varchar(20)  not null,
    created_at  timestamptz  not null,
    updated_at  timestamptz  not null
);
create index idx_forms_owner on forms (owner_id, updated_at desc);

create table form_fields (
    id        uuid primary key,
    form_id   uuid         not null references forms (id) on delete cascade,
    position  int          not null,
    type      varchar(30)  not null,
    label     varchar(500) not null,
    help_text text,
    required  boolean      not null default false,
    config    jsonb,
    archived  boolean      not null default false
);
create index idx_fields_form on form_fields (form_id, position);

create table field_options (
    id       uuid primary key,
    field_id uuid         not null references form_fields (id) on delete cascade,
    position int          not null,
    label    varchar(500) not null,
    archived boolean      not null default false
);
create index idx_options_field on field_options (field_id, position);

create table responses (
    id           uuid primary key,
    form_id      uuid        not null references forms (id) on delete cascade,
    submitted_at timestamptz not null
);
create index idx_responses_form on responses (form_id, submitted_at, id);

create table answers (
    id          uuid primary key,
    response_id uuid  not null references responses (id) on delete cascade,
    field_id    uuid  not null references form_fields (id) on delete cascade,
    value       jsonb not null
);
create index idx_answers_response on answers (response_id);
create index idx_answers_field on answers (field_id);
