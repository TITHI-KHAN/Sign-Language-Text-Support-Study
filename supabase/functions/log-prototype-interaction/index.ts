import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const productionOrigin = "https://tithi-khan.github.io";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function limitedString(value: unknown, maximum: number) {
  return String(value ?? "").slice(0, maximum);
}

function cleanState(value: unknown) {
  const state = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};

  return {
    location: limitedString(state.location, 40),
    segmentation: limitedString(state.segmentation, 40),
    linking_granularity: limitedString(state.linking_granularity, 40),
    navigation: limitedString(state.navigation, 40),
    sidebar_open: Boolean(state.sidebar_open),
    video_visible: Boolean(state.video_visible),
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
    const participantId = limitedString(body.participant_id, 64).trim();
    const sessionId = limitedString(body.session_id, 36);
    const sequence = Number(body.sequence);
    const interaction = body.interaction;
    const eventId = limitedString(interaction?.event_id, 36);
    const occurredAt = new Date(interaction?.occurred_at);

    if (!/^[A-Za-z0-9_-]{1,64}$/.test(participantId)) {
      return new Response("Invalid participant ID", { status: 400, headers });
    }

    if (!uuidPattern.test(sessionId) || !uuidPattern.test(eventId)) {
      return new Response("Invalid interaction ID", { status: 400, headers });
    }

    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > 100000) {
      return new Response("Invalid sequence", { status: 400, headers });
    }

    if (
      !interaction ||
      typeof interaction.action !== "string" ||
      interaction.action.length < 1 ||
      interaction.action.length > 80 ||
      Number.isNaN(occurredAt.getTime())
    ) {
      return new Response("Invalid interaction", { status: 400, headers });
    }

    const videoTime = Number(interaction.video_time);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase
      .from("prototype_interactions")
      .upsert({
        event_id: eventId,
        participant_id: participantId.toLowerCase(),
        session_id: sessionId,
        sequence,
        action: interaction.action,
        feature: limitedString(interaction.feature, 80),
        value: limitedString(interaction.value, 500),
        target_type: limitedString(interaction.target_type, 80),
        target_value: limitedString(interaction.target_value, 1000),
        segment_start: limitedString(interaction.segment_start, 40),
        segment_end: limitedString(interaction.segment_end, 40),
        video_time: Number.isFinite(videoTime) ? videoTime : null,
        occurred_at: occurredAt.toISOString(),
        state: cleanState(interaction.state),
      }, {
        onConflict: "event_id",
        ignoreDuplicates: true,
      });

    if (error) throw error;

    return Response.json({ ok: true }, { headers });
  } catch (error) {
    console.error(error);
    return new Response("Interaction logging failed", {
      status: 500,
      headers,
    });
  }
});
