# Runtime Verify

## Tests

| Scenario | Command | Result | Verdict |
|---|---|---|---|
| Pure migration, legacy key continuity, window boundaries, scheduling and work-hour resolution | `npm run test:auto-sync` | 7/7 tests passed | PASS |
| Existing regression suites plus auto-sync suite | `npm test` | timeline 3, repo-name 4, AI client 7, auto-sync 7; 21/21 passed | PASS |
| Type contract across main/preload/shared/renderer | `npm run typecheck` | exit 0 | PASS |
| Production main/preload/renderer bundle | `npm run build` | exit 0; only existing third-party PURE comment warnings | PASS |
| Changed-file whitespace | `git diff --check` | exit 0 | PASS |
| Renderer source smoke | `node tests/ui-shell.smoke.mjs` | fails on pre-existing emoji in `CodeMaterializeEffect.vue`; unchanged baseline fails at same assertion | BASELINE BLOCKER |

## Notes

The smoke script is renderer-wide and is unrelated to the auto-sync surface. Its failure is reproducible on both the implementation tree and the untouched baseline worktree, so it is not counted as a regression for this feature.
