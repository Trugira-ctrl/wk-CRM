# Database ownership and initial migration

The schema source is `backend/models.py` (SQLAlchemy, PostgreSQL). All WAKA
tables are owned by this application. Do not run Drizzle push for this app.

```sh
python -m backend.migrate
python -m backend.seed
```

`migrate` applies versioned Alembic migrations explicitly and idempotently.
`seed` does not overwrite existing WAKA data. The `--reset` option is
destructive and for fictional demo databases only.

The legacy baseline adopts existing tables without data rewrites. Subsequent
revisions add purchase identity storage and reporting indexes. Future schema
changes must use reviewed Alembic revisions, with backups and recovery plans.
Do not rely on normal API startup to apply schema changes.

Download the fresh sample CSV from the authenticated ADMIN migration page
(`/api/sample-export.csv`). It contains 10 fictional records, with eight valid
and two needing review. Dates are regenerated relative to the current Kigali
calendar day. Fitbase's actual export/API capabilities remain unconfirmed.

`fitbase_sample_export.csv` is a checked-in fictional example using the same
headers. Its dates are fixed for reproducibility; use the in-app download for
current dates. `source_record_id` represents the hypothetical Fitbase member
ID, `plan` the exported plan name, and `branch_id` the mapped 1/2/3 branch.
These are sample field names, not a claim about Fitbase's actual CSV format.