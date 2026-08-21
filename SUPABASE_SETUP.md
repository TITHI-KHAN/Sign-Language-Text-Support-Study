# Supabase response storage

The study sends its final jsPsych CSV to the `submit-study` Edge Function. The
function stores one response per participant ID in the private
`study-responses` Storage bucket. Participant IDs are case-insensitive, so IDs
such as `P2` and `p2` are treated as the same participant. A repeated ID is
rejected without overwriting the original response.

## Deploy

Install and authenticate the Supabase CLI, then run these commands from the
repository root:

```sh
supabase login
supabase link --project-ref dgdflklwjkcndvkvakpp
supabase functions deploy submit-study --no-verify-jwt
```

Supabase automatically supplies `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` to the deployed function. Never add the
service-role key to this repository or to browser code.

## Retrieve responses

In the Supabase dashboard, open **Storage** and select the private
`study-responses` bucket. Each participant creates one CSV named
`participant_<id>.csv`.

## Test before recruitment

Complete the study from the published GitHub Pages site. Confirm that the
success screen appears and that the CSV exists in the private bucket.
Submit the study again with the same ID and confirm that the duplicate-response
screen appears and no second CSV is created.
