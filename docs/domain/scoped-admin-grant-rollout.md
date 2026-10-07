# Scoped Admin Grant Rollout

The schema adds `profiles.is_super_admin` but deliberately does not copy legacy
roles or `pace_group_admins` rows into grants. Run these read-only audits against
the target database before enabling the grant-based application. Review the
results with the account owners and record the approved profile, batch, group,
and duty mapping.

## Audit Queries

List legacy global admins that need an explicit global-access decision:

```sql
SELECT id, auth_user_id, first_name, father_name, role, is_super_admin
FROM profiles
WHERE role = 'super_admin'
ORDER BY first_name, father_name;
```

Find role-only batch or pace admins with no current or legacy assignment rows:

```sql
SELECT
  p.id,
  p.auth_user_id,
  p.first_name,
  p.father_name,
  p.role,
  COUNT(DISTINCT ba.batch_id) AS batch_grants,
  COUNT(DISTINCT paa.id) AS pace_grants,
  COUNT(DISTINCT pga.pace_group_id) AS legacy_group_grants
FROM profiles p
LEFT JOIN batch_admins ba ON ba.profile_id = p.id
LEFT JOIN pace_admin_assignments paa ON paa.profile_id = p.id
LEFT JOIN pace_group_admins pga ON pga.profile_id = p.id
WHERE p.role IN ('batch_admin', 'pace_admin')
GROUP BY p.id
HAVING COUNT(DISTINCT ba.batch_id) = 0
   AND COUNT(DISTINCT paa.id) = 0
   AND COUNT(DISTINCT pga.pace_group_id) = 0
ORDER BY p.first_name, p.father_name;
```

Find legacy group rows that have no current pace-admin assignment for the same
profile and group. The old table has no duty, so each row requires an explicit
duty decision before it can be represented by `pace_admin_assignments`.

```sql
SELECT
  pga.profile_id,
  p.first_name,
  p.father_name,
  pga.pace_group_id,
  pg.name AS pace_group_name,
  pg.batch_id,
  b.name AS batch_name
FROM pace_group_admins pga
JOIN profiles p ON p.id = pga.profile_id
JOIN pace_groups pg ON pg.id = pga.pace_group_id
JOIN batches b ON b.id = pg.batch_id
WHERE NOT EXISTS (
  SELECT 1
  FROM pace_admin_assignments paa
  WHERE paa.profile_id = pga.profile_id
    AND paa.pace_group_id = pga.pace_group_id
)
ORDER BY p.first_name, p.father_name, b.name, pg.name;
```

Summarize the currently effective scoped grants:

```sql
SELECT
  p.id,
  p.first_name,
  p.father_name,
  p.is_super_admin,
  COALESCE(
    array_agg(DISTINCT b.name) FILTER (WHERE b.id IS NOT NULL),
    ARRAY[]::text[]
  ) AS assigned_batches,
  COALESCE(
    array_agg(DISTINCT pg.name) FILTER (WHERE pg.id IS NOT NULL),
    ARRAY[]::text[]
  ) AS assigned_pace_groups
FROM profiles p
LEFT JOIN batch_admins ba ON ba.profile_id = p.id
LEFT JOIN batches b ON b.id = ba.batch_id
LEFT JOIN pace_admin_assignments paa ON paa.profile_id = p.id
LEFT JOIN pace_groups pg ON pg.id = paa.pace_group_id
GROUP BY p.id
HAVING p.is_super_admin
    OR COUNT(DISTINCT ba.batch_id) > 0
    OR COUNT(DISTINCT paa.pace_group_id) > 0
ORDER BY p.first_name, p.father_name;
```

## Cutover

1. Apply migration `0011_scoped_admin_grants` to add the false-by-default flag.
2. Run and review every audit above against production-like data.
3. Manually enable `is_super_admin` only for approved global admins. Add missing
   batch and pace-group assignments from the reviewed mapping; do not infer a
   pace-admin duty from `pace_group_admins`.
4. Deploy the grant-based application and verify each approved workspace and
   cross-scope denial with the reviewed accounts.
5. Keep `profiles.role` and `pace_group_admins` until the compatibility window
   has passed and a separate removal migration has been approved.

The application intentionally does not fall back to `profiles.role` or
`pace_group_admins`. Do not enable it against a database until the reviewed
grants have been populated. Membership remains independent and is determined
from active or grace `batch_memberships` rows.
