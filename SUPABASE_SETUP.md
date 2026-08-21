# Supabase study storage and prototype interaction logging

The study uses Supabase for two related data paths:

- The final jsPsych CSV is stored privately in the `study-responses` Storage
  bucket as `participant_<normalized-id>.csv`.
- Each meaningful prototype action is backed up immediately in the private
  `prototype_interactions` Postgres table.

At final submission, the Edge Function retrieves the session's backed-up
interaction rows and merges them into the jsPsych CSV. The final file therefore
contains study trials and timestamped prototype events together. The table is
also a recovery source if a participant closes the study before submission.

Participant IDs are case-insensitive. For example, `P2` and `p2` use the same
CSV filename, and a repeated final submission is rejected without overwriting
the original response.

## Deploy

From the repository root:

```sh
npx supabase login
npx supabase link --project-ref dgdflklwjkcndvkvakpp
npx supabase db push
npx supabase functions deploy submit-study --no-verify-jwt
npx supabase functions deploy log-prototype-interaction --no-verify-jwt
```

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed
Edge Functions. Never put the service-role key in browser code or this
repository.

The interaction table has Row Level Security enabled and grants no browser
access. Only the validating Edge Function writes interaction rows.

## Retrieve data

- Final combined CSV: **Storage → study-responses**
- Immediate interaction backup: **Table Editor → prototype_interactions**

Interaction rows are ordered using `participant_id`, `session_id`, and
`sequence`. `occurred_at` is the browser timestamp; `received_at` is the
Supabase server timestamp.

## Test before recruitment

1. Start a study with a new test ID and open the prototype.
2. Select several settings and text/video controls.
3. Confirm rows appear in `prototype_interactions` with increasing sequences.
4. Finish the study and download its CSV.
5. Confirm the CSV contains rows where `trial_type` is
   `prototype_interaction`.
6. Submit again using a case variant of the same ID and confirm the duplicate
   response screen appears.
