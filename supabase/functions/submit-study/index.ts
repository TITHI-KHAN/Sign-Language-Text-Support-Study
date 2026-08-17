import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const productionOrigin = "https://tithi-khan.github.io";

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;

  return origin === productionOrigin ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin)
      ? origin
      : productionOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST" || !isAllowedOrigin(origin)) {
    return new Response("Not allowed", { status: 403, headers });
  }

  try {
    const body = await request.json();
    const participantId = String(body.participant_id ?? "").trim();
    const csv = String(body.csv ?? "");

    if (!/^[A-Za-z0-9_-]{1,64}$/.test(participantId)) {
      return new Response("Invalid participant ID", { status: 400, headers });
    }

    if (!csv || csv.length > 5_000_000) {
      return new Response("Invalid submission", { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const bucket = "study-responses";
    const { error: bucketError } = await supabase.storage.createBucket(bucket, {
      public: false,
    });

    if (
      bucketError &&
      !bucketError.message.toLowerCase().includes("already exists")
    ) {
      throw bucketError;
    }

    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const filename = `participant_${participantId}_${timestamp}.csv`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(
        filename,
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        { upsert: false },
      );

    if (uploadError) throw uploadError;

    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error(error);
    return new Response("Submission failed", { status: 500, headers });
  }
});
