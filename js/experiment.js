// ------------------------------------------
// Read Participant ID
// ------------------------------------------

function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const participantID = getParam("pid");
const sessionID = sessionStorage.getItem("study_session_id");
const prototypeOrigin = "https://tithi-khan.github.io";
let prototypeSequence = 0;
const prototypeEventSequences = new Map();
const prototypeEventUploads = new Set();
const supabaseFunctionsBase =
    "https://dgdflklwjkcndvkvakpp.supabase.co/functions/v1";
const submissionUrl = `${supabaseFunctionsBase}/submit-study`;
const interactionUrl =
    `${supabaseFunctionsBase}/log-prototype-interaction`;

window.studyParticipantID = participantID;
window.studySessionID = sessionID;

if (!participantID || !sessionID) {
    document.body.innerHTML =
        "<h2>Your study session is missing. Please return to the participant ID page.</h2>";
    throw new Error("Missing participant ID or session ID");
}

window.addEventListener("message", async (event) => {
    if (event.origin !== prototypeOrigin) return;
    if (event.source !== window.prototypeStudyWindow) return;
    if (event.data?.type !== "prototype-interaction") return;
    if (event.data.participant_id !== participantID.toLowerCase()) return;
    if (event.data.session_id !== sessionID) return;

    const interaction = event.data.interaction;

    if (!interaction || typeof interaction.action !== "string") return;
    if (!/^[0-9a-f-]{36}$/i.test(interaction.event_id || "")) return;
    const firstReceipt = !prototypeEventSequences.has(
        interaction.event_id
    );
    let sequence;

    if (firstReceipt) {
        sequence = ++prototypeSequence;
        prototypeEventSequences.set(
            interaction.event_id,
            sequence
        );
    } else {
        sequence = prototypeEventSequences.get(
            interaction.event_id
        );
    }

    const occurredAt = interaction.occurred_at ||
        new Date().toISOString();
    const eventData = {
        participant_id: participantID.toLowerCase(),
        session_id: sessionID,
        trial_type: "prototype_interaction",
        event_type: interaction.action,
        feature: interaction.feature || "",
        value: interaction.value || "",
        target_type: interaction.target_type || "",
        target_value: interaction.target_value || "",
        segment_start: interaction.segment_start || "",
        segment_end: interaction.segment_end || "",
        video_time: interaction.video_time ?? "",
        occurred_at: occurredAt,
        interaction_event_id: interaction.event_id,
        interaction_sequence: sequence,
        prototype_state: JSON.stringify(
            interaction.state || {}
        )
    };

    if (firstReceipt) {
        jsPsych.data.write(eventData);
    }

    if (prototypeEventUploads.has(interaction.event_id)) return;

    prototypeEventUploads.add(interaction.event_id);

    try {
        const response = await fetch(interactionUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                participant_id: participantID,
                session_id: sessionID,
                sequence,
                interaction: {
                    ...interaction,
                    occurred_at: occurredAt
                }
            })
        });

        if (!response.ok) {
            throw new Error(
                `Interaction backup failed (${response.status})`
            );
        }

        event.source.postMessage(
            {
                type: "prototype-interaction-ack",
                event_id: interaction.event_id,
                sequence
            },
            prototypeOrigin
        );
    } catch (error) {
        console.error("Could not back up prototype event", error);
    } finally {
        prototypeEventUploads.delete(interaction.event_id);
    }
});

// ------------------------------------------
// Initialize jsPsych
// ------------------------------------------

const jsPsych = initJsPsych({

    show_progress_bar: true,

    auto_update_progress_bar: true,

    on_finish: submitStudyData

});

async function submitStudyData() {
    document.body.innerHTML = `
        <main class="submission-screen">
            <h1>Submitting your responses…</h1>
            <p>Please keep this page open.</p>
        </main>
    `;

    try {
        const response = await fetch(submissionUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                participant_id: participantID,
                session_id: sessionID,
                csv: jsPsych.data.get().csv()
            })
        });

        if (response.status === 409) {
            document.body.innerHTML = `
                <main class="submission-screen">
                    <h1>Response Already Submitted</h1>
                    <p>This participant ID has already been used to submit a response.</p>
                    <p>Please ask the researcher for help if you believe this is an error.</p>
                </main>
            `;
            return;
        }

        if (!response.ok) {
            throw new Error(`Submission failed (${response.status})`);
        }

        document.body.innerHTML = `
            <main class="submission-screen">
                <h1>Thank You!</h1>
                <p>Your responses were submitted successfully.</p>
                <p>You may now close this tab.</p>
            </main>
        `;
    } catch (error) {
        console.error(error);

        document.body.innerHTML = `
            <main class="submission-screen">
                <h1>We could not submit your responses</h1>
                <p>Please keep this page open and ask the researcher for help.</p>
                <button id="retrySubmission" class="jspsych-btn">Try Again</button>
            </main>
        `;

        document
            .getElementById("retrySubmission")
            .addEventListener("click", submitStudyData);
    }
}

// ------------------------------------------
// Timeline
// ------------------------------------------

const timeline = [];

// ------------------------------------------
// Helper function
// ------------------------------------------

function loadPage(url, executeScript = false) {

    const versionedUrl = `${url}?v=20260819-1`;

    return {

        type: jsPsychExternalHtml,

        url: versionedUrl,

        cont_btn: "start",

        execute_script: executeScript

    };

}

// ------------------------------------------
// Welcome page
// ------------------------------------------

timeline.push(
    loadPage("instructions/intro.html")
);

// ------------------------------------------
// Tutorial slideshow
// ------------------------------------------

timeline.push(
    loadPage(
        "instructions/tutorial.html",
        true
    )
);

// ------------------------------------------
// Prototype page
// ------------------------------------------

timeline.push(
    loadPage(
        "instructions/prototype.html",
        true
    )
);

// ------------------------------------------
// Finish page
// ------------------------------------------

timeline.push(
    loadPage(
        "instructions/finish.html"
    )
);

// ------------------------------------------
// Start experiment
// ------------------------------------------

jsPsych.run(timeline);
