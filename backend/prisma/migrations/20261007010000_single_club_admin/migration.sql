WITH ranked_admins AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS rank
  FROM "User"
  WHERE "role" = 'ADMIN'
)
UPDATE "User"
SET "role" = 'STAFF'
WHERE "id" IN (SELECT "id" FROM ranked_admins WHERE rank > 1);

CREATE UNIQUE INDEX "User_single_admin_role"
ON "User" ("role")
WHERE "role" = 'ADMIN';

CREATE UNIQUE INDEX "User_single_superadmin_role"
ON "User" ("role")
WHERE "role" = 'SUPERADMIN';
