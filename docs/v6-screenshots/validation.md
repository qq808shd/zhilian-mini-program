# V6 本轮测试执行记录

Node.js 24.18.0。按实际执行顺序保留失败与收敛结果。

## FAIL（已修正）

```sh
node --test tests/learning-dashboard.test.js tests/learning-cards.test.js tests/daily-learning-cards.test.js tests/learning-experience.test.js tests/study-settings.test.js tests/account-experience.test.js tests/v4-learning.test.js tests/storage-sync.test.js
```

```text
✔ My keeps automatic sync out of the menu and copies the configured contact email (24.413334ms)
✔ legacy review links enter automatic review directly (0.896375ms)
✔ entry requires consent, including legacy local users; preview cannot authorize draft release or changed policy (1.17625ms)
✔ initialization, foreground sync and local answer writes make no network calls without consent (4.6935ms)
✔ stopping during wx.login rejects the late code and cannot restart from the next answer (3.6045ms)
✔ stopping aborts requests; stale responses cannot overwrite records or interfere with a newly enabled run (1.623042ms)
✔ late PUT acknowledgement after stopping cannot discard pending local answers (1.729209ms)
✔ avatar is copied before save; failed replacement rolls back only the new file; deletion preserves learning (4.962625ms)
✔ nickname waits for native review; rejection does not save and approval completes pending submission (5.439ms)
✔ skipping profile leaves it untouched and restores the original learning destination (4.124167ms)
✔ welcome never accepts unchecked terms and has no local bypass (3.9495ms)
✔ settings cancellation is inert; answer reset preserves learning and records cloud reset (12.618583ms)
✔ agreeing once starts automatic sync without a separate switch or profile requirement (1.038ms)
✔ a new answer schedules and uploads automatically after consent (2.730875ms)
✔ legacy sync URL returns to profile without manual sync or changing authorization (0.884583ms)
✔ page guard blocks deep links, tab re-entry and stale consent while allowing legal reading (0.779917ms)
✔ app registers the consent guard for every page (1.002958ms)
✔ an older V4 server cannot acknowledge and discard learning settings it does not understand (2.276167ms)
✔ daily cards default to hidden meanings; all three degrees save directly without duplicate or stale taps (44.240917ms)
✔ daily review can be rated from recall without revealing and finishes without exercise or retry (19.914541ms)
✔ same-day newly learned unfamiliar knowledge never enters automatic review, including a pre-created review session (6.743583ms)
✔ leaving during saved feedback preserves completion and reopening resumes exactly at the next card (7.78225ms)
✔ review reveal draft restores after leaving, while revealed browsing does not complete review (3.826167ms)
✔ restoring familiar overdue knowledge joins an existing review plan without losing completed tasks (5.777042ms)
✔ cancelling familiar after skipping today review keeps due count and actionable queue consistent (5.349042ms)
✔ swiping new cards is neutral; hidden later cards and corrected earlier cards persist once (10.907208ms)
✔ swiping review cards is neutral; hidden later cards and corrected earlier cards persist once (14.918541ms)
✔ learning cards hide explanations by default; browsing and revealing remain neutral (10.858167ms)
✔ all three degrees record learned progress and automatically advance exactly once (5.782875ms)
✔ returning to a previous card can correct its degree without duplicating learned progress (9.673916ms)
✔ completing a group ends learning without automatically starting practice (57.495666ms)
✔ familiar requires confirmation, records learned status, and can restore automatic review (2.180208ms)
✔ detail browsing stays neutral; degrees can be saved with meanings collapsed (1.556ms)
✔ review detail allows direct recall and direct familiar confirmation/cancellation (0.932375ms)
✖ today priorities cover empty, new, review, both partial completions, complete and fully learned (14.5545ms)
✔ counts honor user goal, remaining bank and completed new learning without mutation (3.785042ms)
✔ completed review counts actual tasks once, excluding practice and ordinary self-assessment changes (5.658708ms)
✔ practice recommendations filter stale IDs, cap count and use only formally learned related questions (1.07875ms)
✔ actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates (1.804542ms)
✔ guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues (7.003709ms)
✔ result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts (5.529167ms)
✔ onboarding hides and restores TabBar and can be skipped without changing learning data (2.770125ms)
✔ question counts cover empty, short and large banks; all entry points cap at 20 (5.139291ms)
✔ free learning retains the exact reading cursor without reducing cloud progress (15.65ms)
✔ learning group routes to only its associated questions, leaving bank order intact (3.892583ms)
✔ practice records on confirmation exactly once; report and repeat submit cannot duplicate counts (5.5765ms)
✔ assessment allows changes and jumping; cancellation preserves state; submit records unanswered once (3.984625ms)
✔ free practice preserves independent learning degree while wrong counters keep history (6.168958ms)
✔ large learned lists load 40 at a time; independent wrong practice still uses at most 20 (213.934417ms)
✔ catalog still searches and restores incremental results; invalid learning route has recovery (5.245791ms)
✔ 答题事件先保存在本地，云端确认后不会重复累计 (13.991208ms)
✔ 学习进度取较大位置，清空答题会生成云端重置信号 (29.892417ms)
✔ settings replace an untouched plan immediately and preserve whole-category order (19.279333ms)
✔ scope changes apply immediately and returning restores that scope completion and draft (25.773041ms)
✔ integer counts and category totals bound daily new learning (5.904167ms)
✔ free learning does not silently switch daily preferences; due reviews respect the selected category (2.453375ms)
✔ ordered offline settings converge while preserving an already-started canonical plan (0.60025ms)
✖ home exposes new and review destinations without a duplicate practice entry; scope picker changes real categories (4.309334ms)
✔ settings edit only the home scope; count changes without saving are inert (2.183792ms)
✔ slider and precise steps follow current scope bounds without changing scope (1.888833ms)
✔ reset requires scoped confirmation, rejects duplicate taps and preserves other learning (1.406833ms)
✔ stale settings page cannot save or reset a scope silently changed by sync (0.9805ms)
✔ old batch settings upgrade once into scoped plans while preserving legacy records and drafts (5.900375ms)
✔ old default plans remain available while V5 creates stable independent new sessions (1.588625ms)
✔ 200 new items complete independently of due reviews without adding practice or retries (3461.146917ms)
✔ V5 new user gets a stable ten-item new-learning plan and a separate empty review session (5.084792ms)
✖ V5 rating saves and advances immediately; reopening skips the completed knowledge (13.798792ms)
✔ V5 unfinished review keeps its revealed draft across page recreation without recording an assessment (2.881459ms)
✔ V5 completed groups lead to the next group; matching practice remains an explicit action (11.755417ms)
✔ V5 merely swiping cards does not mark learning complete; an unfamiliar rating does (2.894ms)
✔ V5 practice does not formally learn unseen knowledge or change an explicit proficiency (1.013125ms)
✔ V4 spaced intervals are 1 / 3 / 7 days; only due cross-day correct reaches mastery; wrong resets (0.254583ms)
✔ V5 all three ratings count as learned and mastered remains eligible for future review (1.356875ms)
✔ V5 daily new learning ends after ten assessments and next-day review is an independent session (21.002042ms)
✔ V4 search and detail queries leave formal state unchanged (5.776625ms)
✔ V4 migration is idempotent, preserves counters, and does not manufacture mastery or seven-day history (11.980291ms)
✔ V5 cloud snapshot plus pending offline events preserves self-rating and exact next task (2.657459ms)
✔ legacy pending daily answers recover exactly once without a network connection after V5 upgrade (0.460458ms)
✔ V4 assessment recommendation directly starts only wrong questions (1.144458ms)
✔ a fully learned knowledge bank has a usable empty new-learning summary (32.779875ms)
✔ V5 reset removes answer-derived weakness but preserves learned knowledge and daily completion (4.183542ms)
✔ V4 original content IDs, counts, associations and strict batch order remain intact (8.853291ms)
✔ V5 first connection imports legacy cloud records without invented learning or answer history (16.824583ms)
✔ V4 concurrent offline plans keep a bounded canonical plan and retain the other device learning (0.198542ms)
✔ V5 review uses knowledge self-assessment and double confirmation never advances twice (1.197458ms)
✔ V4 the same task completed on another offline plan is not repeated on the canonical plan (0.170584ms)
✔ V4 a crash between legacy counter writes is recovered before any subsequent answer (0.491833ms)
ℹ tests 87
ℹ suites 0
ℹ pass 84
ℹ fail 3
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3677.062792

✖ failing tests:

test at tests/learning-dashboard.test.js:29:1
✖ today priorities cover empty, new, review, both partial completions, complete and fully learned (14.5545ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + 'complete'
  - 'review'

      at TestContext.<anonymous> (/Users/qi_shao/Documents/小程序/tests/learning-dashboard.test.js:40:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1325:25)
      at Test.start (node:internal/test_runner/test:1191:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:385:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'complete',
    expected: 'review',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/study-settings.test.js:65:1
✖ home exposes new and review destinations without a duplicate practice entry; scope picker changes real categories (4.309334ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + [Function: onPractice]
  - undefined

      at TestContext.<anonymous> (/Users/qi_shao/Documents/小程序/tests/study-settings.test.js:68:94)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1325:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:911:18)
      at Test.postRun (node:internal/test_runner/test:1465:19)
      at Test.run (node:internal/test_runner/test:1390:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:911:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    expected: undefined,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/v4-learning.test.js:48:1
✖ V5 rating saves and advances immediately; reopening skips the completed knowledge (13.798792ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

  undefined !== 1

      at TestContext.<anonymous> (/Users/qi_shao/Documents/小程序/tests/v4-learning.test.js:52:53)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1325:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:911:18)
      at Test.postRun (node:internal/test_runner/test:1465:19)
      at Test.run (node:internal/test_runner/test:1390:12)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:385:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

```

## FAIL（已修正）

```sh
node --test tests/learning-dashboard.test.js tests/study-settings.test.js tests/v4-learning.test.js tests/tab-navigation.test.js tests/study-groups.test.js
```

```text
✖ today priorities cover empty, new, review, both partial completions, complete and fully learned (13.000417ms)
✔ counts honor user goal, remaining bank and completed new learning without mutation (5.39225ms)
✔ completed review counts actual tasks once, excluding practice and ordinary self-assessment changes (6.537542ms)
✔ practice recommendations filter stale IDs, cap count and use only formally learned related questions (1.537125ms)
✔ actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates (3.065875ms)
✔ guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues (8.885ms)
✔ result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts (5.386917ms)
✔ onboarding hides and restores TabBar and can be skipped without changing learning data (4.977ms)
✔ frontend empty state is real no-membership response, never network failure (5.927042ms)
✔ join day, quantity, fulfilled, day off and observer present independent contract states (189.519167ms)
✔ bottom sheet adds then corrects cumulative daily value; validation rejects bad inputs (11.811416ms)
✔ network uncertain retry reuses operation id and is not shown as success (4.849917ms)
✔ sheet cancel does not write; share targets contract preview; group invite preserved at welcome (2.373042ms)
✔ creation validation, immutable configuration, acceptance and request retry (1.025084ms)
✔ invite requires preview and acceptance; preview does not join automatically (1.020917ms)
✔ group data boundary does not import learning, content, personal profile or user-supplied auth (0.43975ms)
✔ bottom sheets hide native custom tab layer and restore it on close or leaving page (2.672625ms)
✔ nearly complete quantity does not display a full progress bar (3.773333ms)
✔ group errors distinguish WeChat domain blocking, timeout and undeployed service (0.63425ms)
✔ settings replace an untouched plan immediately and preserve whole-category order (21.299459ms)
✔ scope changes apply immediately and returning restores that scope completion and draft (45.076291ms)
✔ integer counts and category totals bound daily new learning (8.263875ms)
✔ free learning does not silently switch daily preferences; due reviews respect the selected category (4.689916ms)
✔ ordered offline settings converge while preserving an already-started canonical plan (0.520083ms)
✔ home preserves new and review destinations and offers optional practice; scope picker changes real categories (82.962833ms)
✔ settings edit only the home scope; count changes without saving are inert (28.340959ms)
✔ slider and precise steps follow current scope bounds without changing scope (6.911833ms)
✔ reset requires scoped confirmation, rejects duplicate taps and preserves other learning (4.644708ms)
✔ stale settings page cannot save or reset a scope silently changed by sync (2.153875ms)
✔ old batch settings upgrade once into scoped plans while preserving legacy records and drafts (7.233583ms)
✔ old default plans remain available while V5 creates stable independent new sessions (1.726333ms)
✔ 200 new items complete independently of due reviews without adding practice or retries (4549.910209ms)
✔ all four tabs follow actual routes after direct entry, cached return and successful switch (8.0625ms)
✔ repeated, invalid and failed tab switches do not show a false selected page (1.581292ms)
✔ V5 new user gets a stable ten-item new-learning plan and a separate empty review session (10.036667ms)
✔ V5 rating saves and advances immediately; reopening skips the completed knowledge (23.035791ms)
✔ V5 unfinished review keeps its revealed draft across page recreation without recording an assessment (8.434667ms)
✔ V5 completed groups lead to the next group; matching practice remains an explicit action (28.323167ms)
✔ V5 merely swiping cards does not mark learning complete; an unfamiliar rating does (5.965ms)
✔ V5 practice does not formally learn unseen knowledge or change an explicit proficiency (1.651458ms)
✔ V4 spaced intervals are 1 / 3 / 7 days; only due cross-day correct reaches mastery; wrong resets (0.823834ms)
✔ V5 all three ratings count as learned and mastered remains eligible for future review (72.64125ms)
✔ V5 daily new learning ends after ten assessments and next-day review is an independent session (63.086459ms)
✔ V4 search and detail queries leave formal state unchanged (6.195375ms)
✔ V4 migration is idempotent, preserves counters, and does not manufacture mastery or seven-day history (19.355625ms)
✔ V5 cloud snapshot plus pending offline events preserves self-rating and exact next task (3.165625ms)
✔ legacy pending daily answers recover exactly once without a network connection after V5 upgrade (0.508042ms)
✔ V4 assessment recommendation directly starts only wrong questions (1.158792ms)
✔ a fully learned knowledge bank has a usable empty new-learning summary (36.603416ms)
✔ V5 reset removes answer-derived weakness but preserves learned knowledge and daily completion (5.768625ms)
✔ V4 original content IDs, counts, associations and strict batch order remain intact (9.57025ms)
✔ V5 first connection imports legacy cloud records without invented learning or answer history (16.884875ms)
✔ V4 concurrent offline plans keep a bounded canonical plan and retain the other device learning (0.188958ms)
✔ V5 review uses knowledge self-assessment and double confirmation never advances twice (1.053958ms)
✔ V4 the same task completed on another offline plan is not repeated on the canonical plan (0.143167ms)
✔ V4 a crash between legacy counter writes is recovered before any subsequent answer (0.532292ms)
ℹ tests 56
ℹ suites 0
ℹ pass 55
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4954.934333

✖ failing tests:

test at tests/learning-dashboard.test.js:29:1
✖ today priorities cover empty, new, review, both partial completions, complete and fully learned (13.000417ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected

  + 'complete'
  - 'review'

      at TestContext.<anonymous> (/Users/qi_shao/Documents/小程序/tests/learning-dashboard.test.js:43:10)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1325:25)
      at Test.start (node:internal/test_runner/test:1191:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:385:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 'complete',
    expected: 'review',
    operator: 'strictEqual',
    diff: 'simple'
  }

```

## PASS

```sh
node --test tests/learning-dashboard.test.js
```

```text
✔ today priorities cover empty, new, review, both partial completions, complete and fully learned (9.4235ms)
✔ counts honor user goal, remaining bank and completed new learning without mutation (3.843667ms)
✔ completed review counts actual tasks once, excluding practice and ordinary self-assessment changes (2.5075ms)
✔ practice recommendations filter stale IDs, cap count and use only formally learned related questions (0.57725ms)
✔ actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates (1.219667ms)
✔ guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues (1.964917ms)
✔ result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts (3.573209ms)
✔ onboarding hides and restores TabBar and can be skipped without changing learning data (1.223792ms)
ℹ tests 8
ℹ suites 0
ℹ pass 8
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 99.480292

```

## PASS

```sh
node --test tests/learning-dashboard.test.js tests/tab-navigation.test.js
```

```text
✔ today priorities cover empty, new, review, both partial completions, complete and fully learned (10.89225ms)
✔ counts honor user goal, remaining bank and completed new learning without mutation (5.049708ms)
✔ completed review counts actual tasks once, excluding practice and ordinary self-assessment changes (3.165958ms)
✔ practice recommendations filter stale IDs, cap count and use only formally learned related questions (0.761083ms)
✔ actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates (1.320792ms)
✔ guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues (2.06825ms)
✔ result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts (2.940291ms)
✔ onboarding hides and restores TabBar and can be skipped without changing learning data (1.252333ms)
✔ all four tabs follow actual routes after direct entry, cached return and successful switch (5.731917ms)
✔ repeated, invalid and failed tab switches do not show a false selected page (0.857042ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 123.087958

```

## PASS

```sh
node --test tests/learning-dashboard.test.js tests/learning-reset.test.js tests/cloud-sync.test.js
```

```text
✔ 首次登录会把本机历史作为基线导入云端并清理待同步事件 (25.295542ms)
✔ V5 assessments and exclusions never reach an older server or lose their queued IDs (3.512083ms)
✔ V5 settings need advertised version 3 before upload (0.648625ms)
✔ a clean device does not report cloud learning restored from an incompatible GET snapshot (0.590542ms)
✔ a downgraded or invalid PUT snapshot cannot acknowledge V5 records (2.295917ms)
✔ only explicitly acknowledged IDs from this sent batch are removed (0.731875ms)
✔ bootstrap answer events remain queued when another device initialized the account before PUT (0.684709ms)
✔ a PUT response losing settings capability does not consume the preference event (0.574333ms)
✔ learning reset requires dedicated capability before PUT and before acknowledging a response (1.037458ms)
✔ today priorities cover empty, new, review, both partial completions, complete and fully learned (10.964375ms)
✔ counts honor user goal, remaining bank and completed new learning without mutation (2.799333ms)
✔ completed review counts actual tasks once, excluding practice and ordinary self-assessment changes (4.758583ms)
✔ practice recommendations filter stale IDs, cap count and use only formally learned related questions (0.578416ms)
✔ actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates (1.581ms)
✔ guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues (2.838458ms)
✔ result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts (4.00425ms)
✔ onboarding hides and restores TabBar and can be skipped without changing learning data (1.249667ms)
✔ scoped reset clears learning, exemption, due plans, drafts and cursors while retaining other scopes and question statistics (18.977917ms)
✔ reset tombstones reject delayed learning and seeds; duplicate reset preserves later learning (9.966125ms)
✔ pending reset over a newer cloud snapshot preserves later explicit learning with fresh memory (0.209875ms)
✔ old snapshots cannot erase an offline reset; stale cloud progress cannot resurrect it (3.661458ms)
ℹ tests 21
ℹ suites 0
ℹ pass 21
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 122.039958

```

## PASS

```sh
node --test tests/learning-dashboard.test.js tests/learning-cards.test.js tests/daily-learning-cards.test.js tests/learning-experience.test.js tests/study-settings.test.js tests/account-experience.test.js tests/v4-learning.test.js tests/storage-sync.test.js tests/learning-reset.test.js tests/cloud-sync.test.js tests/tab-navigation.test.js tests/study-groups.test.js
```

```text
✔ My keeps automatic sync out of the menu and copies the configured contact email (27.788958ms)
✔ legacy review links enter automatic review directly (3.057041ms)
✔ entry requires consent, including legacy local users; preview cannot authorize draft release or changed policy (0.491458ms)
✔ initialization, foreground sync and local answer writes make no network calls without consent (2.73075ms)
✔ stopping during wx.login rejects the late code and cannot restart from the next answer (2.902417ms)
✔ stopping aborts requests; stale responses cannot overwrite records or interfere with a newly enabled run (3.035208ms)
✔ late PUT acknowledgement after stopping cannot discard pending local answers (2.748791ms)
✔ avatar is copied before save; failed replacement rolls back only the new file; deletion preserves learning (2.047042ms)
✔ nickname waits for native review; rejection does not save and approval completes pending submission (4.022292ms)
✔ skipping profile leaves it untouched and restores the original learning destination (2.013375ms)
✔ welcome never accepts unchecked terms and has no local bypass (2.760083ms)
✔ settings cancellation is inert; answer reset preserves learning and records cloud reset (32.668167ms)
✔ agreeing once starts automatic sync without a separate switch or profile requirement (1.799583ms)
✔ a new answer schedules and uploads automatically after consent (2.79325ms)
✔ legacy sync URL returns to profile without manual sync or changing authorization (1.374541ms)
✔ page guard blocks deep links, tab re-entry and stale consent while allowing legal reading (1.257833ms)
✔ app registers the consent guard for every page (1.792625ms)
✔ an older V4 server cannot acknowledge and discard learning settings it does not understand (3.176417ms)
✔ 首次登录会把本机历史作为基线导入云端并清理待同步事件 (47.952334ms)
✔ V5 assessments and exclusions never reach an older server or lose their queued IDs (4.948917ms)
✔ V5 settings need advertised version 3 before upload (1.629083ms)
✔ a clean device does not report cloud learning restored from an incompatible GET snapshot (1.76725ms)
✔ a downgraded or invalid PUT snapshot cannot acknowledge V5 records (2.743917ms)
✔ only explicitly acknowledged IDs from this sent batch are removed (0.720708ms)
✔ bootstrap answer events remain queued when another device initialized the account before PUT (0.648334ms)
✔ a PUT response losing settings capability does not consume the preference event (1.431125ms)
✔ learning reset requires dedicated capability before PUT and before acknowledging a response (2.729583ms)
✔ daily cards default to hidden meanings; all three degrees save directly without duplicate or stale taps (88.374417ms)
✔ daily review can be rated from recall without revealing and finishes without exercise or retry (22.332125ms)
✔ same-day newly learned unfamiliar knowledge never enters automatic review, including a pre-created review session (10.634125ms)
✔ leaving during saved feedback preserves completion and reopening resumes exactly at the next card (3.844667ms)
✔ review reveal draft restores after leaving, while revealed browsing does not complete review (3.900125ms)
✔ restoring familiar overdue knowledge joins an existing review plan without losing completed tasks (11.002708ms)
✔ cancelling familiar after skipping today review keeps due count and actionable queue consistent (5.833291ms)
✔ swiping new cards is neutral; hidden later cards and corrected earlier cards persist once (15.837584ms)
✔ swiping review cards is neutral; hidden later cards and corrected earlier cards persist once (26.17825ms)
✔ learning cards hide explanations by default; browsing and revealing remain neutral (13.8775ms)
✔ all three degrees record learned progress and automatically advance exactly once (10.474375ms)
✔ returning to a previous card can correct its degree without duplicating learned progress (14.683583ms)
✔ completing a group ends learning without automatically starting practice (88.211042ms)
✔ familiar requires confirmation, records learned status, and can restore automatic review (4.176917ms)
✔ detail browsing stays neutral; degrees can be saved with meanings collapsed (3.114208ms)
✔ review detail allows direct recall and direct familiar confirmation/cancellation (1.013334ms)
✔ today priorities cover empty, new, review, both partial completions, complete and fully learned (21.247416ms)
✔ counts honor user goal, remaining bank and completed new learning without mutation (3.601041ms)
✔ completed review counts actual tasks once, excluding practice and ordinary self-assessment changes (8.421584ms)
✔ practice recommendations filter stale IDs, cap count and use only formally learned related questions (1.201708ms)
✔ actual answers update scheduling for learned items without changing degree, while unlearned/excluded cannot claim automatic schedule updates (3.093834ms)
✔ guide is local once per version; dashboard and guide preserve old records, due dates, answers, progress, drafts and offline queues (3.928458ms)
✔ result feedback tracks only this session; replay confirmation does not inflate evidence or answer counts (5.945709ms)
✔ onboarding hides and restores TabBar and can be skipped without changing learning data (1.3655ms)
✔ question counts cover empty, short and large banks; all entry points cap at 20 (1.842834ms)
✔ free learning retains the exact reading cursor without reducing cloud progress (24.673416ms)
✔ learning group routes to only its associated questions, leaving bank order intact (6.717292ms)
✔ practice records on confirmation exactly once; report and repeat submit cannot duplicate counts (5.173333ms)
✔ assessment allows changes and jumping; cancellation preserves state; submit records unanswered once (2.615167ms)
✔ free practice preserves independent learning degree while wrong counters keep history (9.407708ms)
✔ large learned lists load 40 at a time; independent wrong practice still uses at most 20 (273.343791ms)
✔ catalog still searches and restores incremental results; invalid learning route has recovery (5.362417ms)
✔ scoped reset clears learning, exemption, due plans, drafts and cursors while retaining other scopes and question statistics (21.344834ms)
✔ reset tombstones reject delayed learning and seeds; duplicate reset preserves later learning (18.631666ms)
✔ pending reset over a newer cloud snapshot preserves later explicit learning with fresh memory (0.558125ms)
✔ old snapshots cannot erase an offline reset; stale cloud progress cannot resurrect it (6.359291ms)
✔ 答题事件先保存在本地，云端确认后不会重复累计 (19.237875ms)
✔ 学习进度取较大位置，清空答题会生成云端重置信号 (21.264833ms)
✔ frontend empty state is real no-membership response, never network failure (8.485041ms)
✔ join day, quantity, fulfilled, day off and observer present independent contract states (58.218375ms)
✔ bottom sheet adds then corrects cumulative daily value; validation rejects bad inputs (6.13425ms)
✔ network uncertain retry reuses operation id and is not shown as success (2.422417ms)
✔ sheet cancel does not write; share targets contract preview; group invite preserved at welcome (2.188875ms)
✔ creation validation, immutable configuration, acceptance and request retry (1.132791ms)
✔ invite requires preview and acceptance; preview does not join automatically (1.06325ms)
✔ group data boundary does not import learning, content, personal profile or user-supplied auth (0.428958ms)
✔ bottom sheets hide native custom tab layer and restore it on close or leaving page (2.274625ms)
✔ nearly complete quantity does not display a full progress bar (5.101875ms)
✔ group errors distinguish WeChat domain blocking, timeout and undeployed service (0.630708ms)
✔ settings replace an untouched plan immediately and preserve whole-category order (13.698792ms)
✔ scope changes apply immediately and returning restores that scope completion and draft (35.600459ms)
✔ integer counts and category totals bound daily new learning (7.403583ms)
✔ free learning does not silently switch daily preferences; due reviews respect the selected category (2.090125ms)
✔ ordered offline settings converge while preserving an already-started canonical plan (0.251458ms)
✔ home preserves new and review destinations and offers optional practice; scope picker changes real categories (7.815208ms)
✔ settings edit only the home scope; count changes without saving are inert (2.52325ms)
✔ slider and precise steps follow current scope bounds without changing scope (3.345292ms)
✔ reset requires scoped confirmation, rejects duplicate taps and preserves other learning (1.510708ms)
✔ stale settings page cannot save or reset a scope silently changed by sync (1.309875ms)
✔ old batch settings upgrade once into scoped plans while preserving legacy records and drafts (4.478083ms)
✔ old default plans remain available while V5 creates stable independent new sessions (1.535042ms)
✔ 200 new items complete independently of due reviews without adding practice or retries (3645.79125ms)
✔ all four tabs follow actual routes after direct entry, cached return and successful switch (4.139916ms)
✔ repeated, invalid and failed tab switches do not show a false selected page (0.525166ms)
✔ V5 new user gets a stable ten-item new-learning plan and a separate empty review session (5.089542ms)
✔ V5 rating saves and advances immediately; reopening skips the completed knowledge (13.308375ms)
✔ V5 unfinished review keeps its revealed draft across page recreation without recording an assessment (2.97025ms)
✔ V5 completed groups lead to the next group; matching practice remains an explicit action (13.052667ms)
✔ V5 merely swiping cards does not mark learning complete; an unfamiliar rating does (2.398542ms)
✔ V5 practice does not formally learn unseen knowledge or change an explicit proficiency (0.994709ms)
✔ V4 spaced intervals are 1 / 3 / 7 days; only due cross-day correct reaches mastery; wrong resets (0.242625ms)
✔ V5 all three ratings count as learned and mastered remains eligible for future review (1.34025ms)
✔ V5 daily new learning ends after ten assessments and next-day review is an independent session (23.759333ms)
✔ V4 search and detail queries leave formal state unchanged (5.351541ms)
✔ V4 migration is idempotent, preserves counters, and does not manufacture mastery or seven-day history (12.284041ms)
✔ V5 cloud snapshot plus pending offline events preserves self-rating and exact next task (2.909834ms)
✔ legacy pending daily answers recover exactly once without a network connection after V5 upgrade (0.509792ms)
✔ V4 assessment recommendation directly starts only wrong questions (1.50325ms)
✔ a fully learned knowledge bank has a usable empty new-learning summary (33.99225ms)
✔ V5 reset removes answer-derived weakness but preserves learned knowledge and daily completion (4.414792ms)
✔ V4 original content IDs, counts, associations and strict batch order remain intact (10.015417ms)
✔ V5 first connection imports legacy cloud records without invented learning or answer history (16.820917ms)
✔ V4 concurrent offline plans keep a bounded canonical plan and retain the other device learning (0.168375ms)
✔ V5 review uses knowledge self-assessment and double confirmation never advances twice (0.983083ms)
✔ V4 the same task completed on another offline plan is not repeated on the canonical plan (0.098125ms)
✔ V4 a crash between legacy counter writes is recovered before any subsequent answer (0.428ms)
ℹ tests 113
ℹ suites 0
ℹ pass 113
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4052.156292

```

## PASS：本次JS语法与JSON格式

以下为本轮实际执行的检查（用Node逐文件调用，不依赖不存在的lint/build命令）：

```js
const fs=require('node:fs'),cp=require('node:child_process');
const paths=cp.execFileSync('git',['diff','--name-only','--','miniprogram','tests','scripts'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const added=['miniprogram/utils/learningDashboard.js','miniprogram/utils/learningGuide.js','miniprogram/components/learning-guide/index.js','miniprogram/components/learning-guide/index.json','scripts/prepare-v6-preview.js','tests/learning-dashboard.test.js'];
const files=[...new Set([...paths,...added])];
for(const p of files){if(p.endsWith('.js'))cp.execFileSync(process.execPath,['--check',p]);if(p.endsWith('.json'))JSON.parse(fs.readFileSync(p));}
```

结果：13个JS通过，3个JSON可解析。源码数据统计1044条知识/1089道题。

## PASS：差异检查

```sh
git diff --check
```

## PASS：隔离微信预览准备

```sh
node scripts/prepare-v6-preview.js /private/tmp/zhilian-v6-preview-review
```

原生交互和截图见[索引](README.md)，不能把这些合成场景当成生产同步验收。
