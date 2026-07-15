# This or That Parity Notes

SurveyFlow's `this-or-that` question type mirrors the AI Studio export behavior from:

- `/Users/mikehilton/Downloads/surveyflow-ai/src/SurveyView.tsx`
- `/Users/mikehilton/Downloads/surveyflow-ai/src/SurveyEditor.tsx`
- `/Users/mikehilton/Downloads/surveyflow-ai/src/ReportView.tsx`
- `/Users/mikehilton/Downloads/surveyflow-ai/src/types.ts`

## Question Runtime

- Generate unique pairwise matchups from static options or dynamic source answers.
- Shuffle matchup order and randomly swap left/right presentation.
- Cap generated matchups at 15.
- Persist matchups in the answer payload as `{ left, right, selected, inferred }`.
- Preserve existing matchups when their option set still matches the current options.
- Show pair progress dots and an animated left/right choice card UI.
- Save each selection incrementally.
- Auto-advance to the next unanswered matchup.
- Auto-advance to the next question, or auto-submit if it is the final question.
- Hide the normal Back/Submit controls for this question type.

## Inference Algorithm

- The setting is question-level: `question.useInferenceAlgorithm`.
- It is enabled by default for `this-or-that` unless explicitly set to `false`.
- Direct user selections build a directed win graph.
- Transitive reachability infers unanswered outcomes where `A > B` and `B > C` implies `A > C`.
- Cycles are not treated as strict inferred wins.
- Inferred matchups are marked with `inferred: true`.
- User-made selections always remain authoritative.

## Ranking Calculation

The shared ranking helper lives in `lib/surveyflow/this-or-that.ts`.

- With inference on, rankings use strict transitive wins plus the AI Studio win-percentage tie breaker.
- With inference off, rankings fall back to direct win counts.
- Ranking stats include rank, direct wins, matches, win percentage, total strict wins, inferred wins, and final rank value.
- The public thank-you page and admin reports both use this shared helper.

## Thank You Results

- Survey settings can enable preference results with `thankYouShowResults`.
- The editor selects a highlighted question via `thankYouHighlightedQuestionId`.
- Supported showcased question types: ranked order, this-or-that, multiple choice.
- Each answer option can have a support/resource link in `thankYouOptionLinks`.
- The public thank-you page displays ranked results and opens configured links in a new tab.

## Test Responses

- Public submissions include `isTest` when the survey is in testing status or the URL has `?test=true` / `?preview=true`.
- Test responses are saved in Supabase with `surveyflow_responses.is_test = true`.
- Test completions do not increment the official survey `responses_count`.
- Reports expose test-response filtering and a Clear Test Data action that deletes only `is_test = true` rows.

## Reports

- Reports show completed, partial, test, views, average score, and average seconds.
- Question analytics include multiple-choice aggregates, rating averages, ranked-order aggregates, and this-or-that aggregate rankings.
- Individual response detail shows computed this-or-that rankings plus raw matchup history.
- CSV export includes the `is_test` column and serialized matchup answer payloads.
