-- 001-workspaces — drops Studio's tables. Every workspace and key in them is lost; run only locally or by the guarded
-- `rollback` verb.

DROP TABLE IF EXISTS {{schema}}.data_protection_keys;
DROP TABLE IF EXISTS {{schema}}.workspaces;
