-- A stand-in for Identity's `identity` set at level 1: only the two tables it publishes to other owners, with the key
-- Studio references. The real set carries far more; Studio may key into these two only.

CREATE TABLE IF NOT EXISTS {{schema}}.identity_users (
    id         UUID        NOT NULL,
    user_name  TEXT,
    email      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT pk_identity_users PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS {{schema}}.identity_organizations (
    id         UUID        NOT NULL,
    name       TEXT        NOT NULL DEFAULT '',
    slug       TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_identity_organizations PRIMARY KEY (id)
);
