-- Emails are now normalized (trimmed, lowercased) at sign-up and login, so
-- existing rows are brought into the same form. A row is only rewritten when
-- no OTHER account would end up with the same normalized email; such
-- collisions (e.g. "Bob@x.com" and "bob@x.com") are left untouched for manual
-- review, and login still finds them through a case-insensitive fallback.
-- No schema change: the unique indexes on "email" stay as they are.

UPDATE "users" AS u
SET "email" = LOWER(TRIM(u."email"))
WHERE u."email" <> LOWER(TRIM(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "users" AS o
    WHERE o."id" <> u."id" AND LOWER(TRIM(o."email")) = LOWER(TRIM(u."email"))
  );

UPDATE "admin_users" AS u
SET "email" = LOWER(TRIM(u."email"))
WHERE u."email" <> LOWER(TRIM(u."email"))
  AND NOT EXISTS (
    SELECT 1 FROM "admin_users" AS o
    WHERE o."id" <> u."id" AND LOWER(TRIM(o."email")) = LOWER(TRIM(u."email"))
  );
