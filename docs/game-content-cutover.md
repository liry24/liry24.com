# Game content cutover

Rehearse the cutover on the dev Worker at `https://dev-liry24-com.liry.workers.dev` with its dev D1 and R2 bindings. Production requires explicit approval after the dev rehearsal. Preserve a recoverable D1 snapshot and the R2 objects referenced by both content revisions before applying the change.

1. Build and deploy transition commit `4829a629233bc90759b64fb8468fe998849bc59c` to the selected environment. Apply the generated D1 migration `0001_default.sql` to that environment's `DB` before using the migration endpoint. Verify the binding database name and ID against the environment in `AGENTS.md`.
2. Sign in as the administrator on that Worker. In the browser console on the Worker origin, run the request below with `action` set to `inspect`. Review the legacy game IDs, published and draft ranks, and active schedule IDs. The migration supports the reviewed VALORANT V25A6 entry. Resolve conflicting rank drafts, extra rank entries, or active legacy schedules before copying. Keep editorial changes to the affected records paused until cutover finishes.
3. Run the request with `action` set to `copy`. This copies saved games to the D1 catalog using their existing IDs and the latest saved version. For the reviewed rank, it publishes the VALORANT metric and Game Stats period, preserving the badge and profile URL. Verify `/api/portfolio/gameStats`, the home card, and the profile link. A repeat `copy` is safe while the inspected source and destination are unchanged.
4. Run the request with `action` set to `retire`. Confirm `/api/portfolio/ranks` returns an empty collection and the home card still renders correctly. Historical revisions and the badge object remain available for recovery.
5. Deploy the final Worker. Confirm `/api/portfolio/ranks` and `/api/portfolio/games` return 404, the Game Stats card and existing game mentions render, and Games are directly editable in **Game Stats → Game settings**. If the final Worker needs to be rolled back, the transition Worker can still render the Game Stats card with the copied catalog and the existing legacy game metadata.

```js
const action = 'inspect'
const result = await fetch('/api/admin/migrations/game-content', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ action }),
})
console.log(result.status, await result.json())
```

The transition commit includes `tests/worker/game-content-migration.test.ts` to exercise the process against local D1 and R2. The final Worker serves the copied data through its Game Stats and game mention routes.
