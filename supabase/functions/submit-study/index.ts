import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const productionOrigin = "https://tithi-khan.github.io";

function isAllowedOrigin(origin: string | null) {
  if (!origin) return false;

  return origin === productionOrigin ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function corsHeaders(origin: string | null) {
  const allowedOrigin = origin && isAllowedOrigin(origin)
    ? origin
    : productionOrigin;

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function combineCsvWithInteractions(
  csv: string,
  interactions: Record<string, unknown>[],
) {
  const rows = parseCsv(csv);

  if (!rows.length) return csv;

  const eventColumns = [
    "participant_id",
    "session_id",
    "trial_type",
    "event_type",
    "feature",
    "value",
    "target_type",
    "target_value",
    "segment_start",
    "segment_end",
    "video_time",
    "occurred_at",
    "received_at",
    "interaction_event_id",
    "interaction_sequence",
    "prototype_state",
  ];
  const headers = rows[0];

  for (const column of eventColumns) {
    if (!headers.includes(column)) headers.push(column);
  }

  const normalizedRows = rows.slice(1).map((existingRow) => {
    const padded = existingRow.slice(0, headers.length);
    while (padded.length < headers.length) padded.push("");
    return padded;
  });

  for (const interaction of interactions) {
    const values: Record<string, unknown> = {
      participant_id: interaction.participant_id,
      session_id: interaction.session_id,
      trial_type: "prototype_interaction",
      event_type: interaction.action,
      feature: interaction.feature,
      value: interaction.value,
      target_type: interaction.target_type,
      target_value: interaction.target_value,
      segment_start: interaction.segment_start,
      segment_end: interaction.segment_end,
      video_time: interaction.video_time,
      occurred_at: interaction.occurred_at,
      received_at: interaction.received_at,
      interaction_event_id: interaction.event_id,
      interaction_sequence: interaction.sequence,
      prototype_state: JSON.stringify(interaction.state ?? {}),
    };

    normalizedRows.push(headers.map((header) => values[header] ?? ""));
  }

  return [headers, ...normalizedRows]
    .map((rowValues) => rowValues.map(csvCell).join(","))
    .join("\n");
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
    const sessionId = String(body.session_id ?? "");
    const csv = String(body.csv ?? "");

    if (!/^[A-Za-z0-9_-]{1,64}$/.test(participantId)) {
      return new Response("Invalid participant ID", { status: 400, headers });
    }

    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
      return new Response("Invalid study session", { status: 400, headers });
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

    const normalizedParticipantId = participantId.toLowerCase();
    const { data: interactions, error: interactionError } = await supabase
      .from("prototype_interactions")
      .select("*")
      .eq("participant_id", normalizedParticipantId)
      .eq("session_id", sessionId)
      .order("sequence", { ascending: true })
      .limit(5000);

    if (interactionError) throw interactionError;

    const combinedCsv = combineCsvWithInteractions(
      csv,
      interactions ?? [],
    );
    const filename = `participant_${normalizedParticipantId}.csv`;
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(
        filename,
        new Blob([combinedCsv], { type: "text/csv;charset=utf-8" }),
        { upsert: false },
      );

    if (uploadError) {
      const statusCode = Number(
        (uploadError as { statusCode?: string | number }).statusCode,
      );
      const message = uploadError.message.toLowerCase();

      if (
        statusCode === 409 ||
        message.includes("already exists") ||
        message.includes("duplicate")
      ) {
        return new Response("Participant ID has already submitted", {
          status: 409,
          headers,
        });
      }

      throw uploadError;
    }

    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error(error);
    return new Response("Submission failed", { status: 500, headers });
  }
});
