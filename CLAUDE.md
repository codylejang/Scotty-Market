In `@backend/src/orchestrator/workflow.ts` around lines 55 - 74, ensureTables
currently only creates workflow_execution_log but execute reads/writes the
idempotency_key table, causing failures on a fresh DB; update the ensureTables
method to also create the idempotency_key table (and appropriate indexes) so
execute can use it without runtime errors. Locate the ensureTables method in
backend/src/orchestrator/workflow.ts and add a CREATE TABLE IF NOT EXISTS
idempotency_key (...) statement (matching the cols used by execute) and any
needed CREATE INDEX IF NOT EXISTS entries to mirror how workflow_execution_log
is created.

In `@backend/src/orchestrator/workflow.ts` around lines 83 - 146, The idempotency
pre-check using idempotencyKey and SELECT from idempotency_key is racy; instead
atomically claim the key before running the workflow and write the result after
completion: attempt to insert a placeholder row for idempotencyKey (using the
same idempotency_key table) in a single atomic statement (e.g., INSERT OR IGNORE
/ ON CONFLICT DO NOTHING or within a transaction) and if the insert fails treat
it as an idempotency hit and return the stored result; if the insert succeeds
proceed to run the workflow and then UPDATE the same idempotency_key row with
the actual JSON result; locate the logic around workflow.idempotencyKey(input),
the SELECT of idempotency_key, and the later INSERT into idempotency_key to
implement this change.

In `@backend/src/services/ingestion.ts` around lines 19 - 21, The variable
`updated` is declared but never incremented; either remove it from the
return/interface or increment it whenever pending records are
updated—specifically, inside the code path that calls updatePendingStmt (or
whatever function performs the DB update for linking pending items) increment
`updated` by the number of rows affected (e.g., add the returned
affectedRows/count from updatePendingStmt to `updated`) and ensure the
function's return/interface still includes `updated`; if you prefer the other
option, remove `updated` from the return value and the related interface
instead.

In `@backend/src/services/quest-evaluation.ts` around lines 176 - 191, The
TRANSFER_AMOUNT branch's windowExpired handling is confusing and contains
unreachable/redundant checks; in the windowExpired branch (using variables
windowExpired, confirmedValue, targetAmount, newStatus, explanation) replace the
current ternary/conditional that reassigns explanation with explicit logic: if
confirmedValue >= targetAmount set newStatus = 'COMPLETED_VERIFIED' and set
explanation to the transferred/target success message (same format used
earlier), else set newStatus = 'EXPIRED' and set explanation to the
expired/deadline message stating only $confirmedValue of $targetAmount
transferred; remove the redundant confirmedValue >= targetAmount check and the
nested windowExpired check so the branch is clear and deterministic.