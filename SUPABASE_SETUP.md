# Supabase response storage

The study sends its final jsPsych CSV to the `submit-study` Edge Function. The
function stores each response as a separate file in the private
`study-responses` Storage bucket.

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
`study-responses` bucket. Each completed session creates one timestamped CSV.

## Test before recruitment

Complete the study from the published GitHub Pages site. Confirm that the
success screen appears and that the CSV exists in the private bucket.
