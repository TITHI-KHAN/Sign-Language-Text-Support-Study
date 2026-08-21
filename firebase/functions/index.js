const { randomUUID } = require("node:crypto");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

initializeApp();

const db = getFirestore();
const allowedOrigins = [
  "https://tithi-khan.github.io",
  "https://signlanguage-textsupport-study.web.app",
  "https://signlanguage-textsupport-study.firebaseapp.com",
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/
];
const callableOptions = {
  region: "us-central1",
  cors: allowedOrigins,
  maxInstances: 10
};

function normalizeParticipantId(value) {
  const participantId = String(value ?? "").trim();

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(participantId)) {
    throw new HttpsError(
      "invalid-argument",
      "Participant ID must contain only letters, numbers, underscores, or hyphens."
    );
  }

  return {
    original: participantId,
    normalized: participantId.toLowerCase()
  };
}

function requireSessionId(value) {
  const sessionId = String(value ?? "");

  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new HttpsError("invalid-argument", "Invalid study session.");
  }

  return sessionId;
}

async function requireParticipantSession(participantId, sessionId) {
  const participantRef = db.collection("participants").doc(participantId);
  const snapshot = await participantRef.get();

  if (!snapshot.exists || snapshot.get("sessionId") !== sessionId) {
    throw new HttpsError("permission-denied", "Invalid study session.");
  }

  return { participantRef, participant: snapshot.data() };
}

exports.reserveParticipant = onCall(callableOptions, async (request) => {
  const participantId = normalizeParticipantId(request.data?.participantId);
  const sessionId = requireSessionId(request.data?.sessionId);
  const participantRef = db
    .collection("participants")
    .doc(participantId.normalized);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(participantRef);

    if (existing.exists) {
      throw new HttpsError(
        "already-exists",
        "This participant ID has already been used."
      );
    }

    transaction.create(participantRef, {
      participantId: participantId.normalized,
      enteredParticipantId: participantId.original,
      sessionId,
      status: "reserved",
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return { ok: true };
});

exports.logPrototypeInteraction = onCall(
  callableOptions,
  async (request) => {
    const participantId = normalizeParticipantId(
      request.data?.participantId
    ).normalized;
    const sessionId = requireSessionId(request.data?.sessionId);
    const sequence = Number(request.data?.sequence);
    const interaction = request.data?.interaction;

    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 1 ||
      sequence > 100000
    ) {
      throw new HttpsError("invalid-argument", "Invalid event sequence.");
    }

    if (
      !interaction ||
      typeof interaction.action !== "string" ||
      interaction.action.length < 1 ||
      interaction.action.length > 80
    ) {
      throw new HttpsError("invalid-argument", "Invalid interaction.");
    }

    const { participant } = await requireParticipantSession(
      participantId,
      sessionId
    );

    if (participant.status === "submitted") {
      throw new HttpsError("failed-precondition", "Study is complete.");
    }

    const eventId = `${sessionId}_${String(sequence).padStart(6, "0")}`;
    const eventRef = db.collection("prototypeInteractions").doc(eventId);

    await eventRef.create({
      participantId,
      sessionId,
      sequence,
      action: interaction.action,
      feature: String(interaction.feature ?? "").slice(0, 80),
      value: String(interaction.value ?? "").slice(0, 500),
      targetType: String(interaction.target_type ?? "").slice(0, 80),
      targetValue: String(interaction.target_value ?? "").slice(0, 1000),
      state: interaction.state && typeof interaction.state === "object"
        ? interaction.state
        : {},
      clientOccurredAt: String(interaction.occurred_at ?? "").slice(0, 40),
      receivedAt: FieldValue.serverTimestamp()
    });

    return { ok: true, eventId };
  }
);

exports.submitStudy = onCall(callableOptions, async (request) => {
  const participantId = normalizeParticipantId(
    request.data?.participantId
  ).normalized;
  const sessionId = requireSessionId(request.data?.sessionId);
  const csv = String(request.data?.csv ?? "");

  if (!csv || csv.length > 5_000_000) {
    throw new HttpsError("invalid-argument", "Invalid study response.");
  }

  const { participantRef, participant } =
    await requireParticipantSession(participantId, sessionId);

  if (participant.status === "submitted") {
    throw new HttpsError(
      "already-exists",
      "This participant ID has already submitted."
    );
  }

  const filename = `study-responses/participant_${participantId}.csv`;
  const file = getStorage().bucket().file(filename);

  try {
    await file.save(csv, {
      contentType: "text/csv; charset=utf-8",
      resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
      metadata: {
        cacheControl: "no-store",
        metadata: {
          participantId,
          sessionId,
          submissionId: randomUUID()
        }
      }
    });
  } catch (error) {
    if (error.code === 412 || error.code === 409) {
      throw new HttpsError(
        "already-exists",
        "This participant ID has already submitted."
      );
    }

    console.error(error);
    throw new HttpsError("internal", "Submission failed.");
  }

  await participantRef.update({
    status: "submitted",
    submittedAt: FieldValue.serverTimestamp(),
    responseFile: filename
  });

  return { ok: true };
});
