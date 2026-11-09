-- 001-workspaces — Studio's member workspaces and the Data Protection key ring, in schema `studio` of the product
-- database.
--
-- A workspace is one member's state in one organization; its id is derived from both (StudioAccess.WorkspaceFor), so a
-- row is found without a lookup. `organization_id` and `user_id` key into Identity's published accounts and
-- organizations; Identity never deletes either row, so RESTRICT never blocks. A row copied from the SQLite store whose
-- member no longer matches an Identity account keeps both null. State and material JSON stay text, byte for byte as
-- the editor saved them; normalized storage is a later design.

CREATE TABLE IF NOT EXISTS {{schema}}.workspaces (
    workspace_id    UUID        NOT NULL,
    organization_id UUID,
    user_id         UUID,
    revision        BIGINT      NOT NULL,
    state_json      TEXT        NOT NULL,
    materials_json  TEXT        NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL,

    CONSTRAINT pk_workspaces PRIMARY KEY (workspace_id),
    CONSTRAINT ck_workspaces_revision CHECK (revision >= 0),
    CONSTRAINT fk_workspaces_organization FOREIGN KEY (organization_id)
        REFERENCES {{schema:identity}}.identity_organizations (id) ON DELETE RESTRICT,
    CONSTRAINT fk_workspaces_user FOREIGN KEY (user_id)
        REFERENCES {{schema:identity}}.identity_users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS ix_workspaces_organization_id ON {{schema}}.workspaces (organization_id);
CREATE INDEX IF NOT EXISTS ix_workspaces_user_id ON {{schema}}.workspaces (user_id);

-- The ring that encrypts sign-in cookies and the antiforgery token, shared by every Studio replica.
CREATE TABLE IF NOT EXISTS {{schema}}.data_protection_keys (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    friendly_name TEXT        NOT NULL,
    xml           TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_data_protection_keys PRIMARY KEY (id),
    CONSTRAINT uq_data_protection_keys_friendly_name UNIQUE (friendly_name)
);
