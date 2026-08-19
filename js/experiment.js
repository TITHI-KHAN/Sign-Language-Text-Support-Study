// ------------------------------------------
// Read Participant ID
// ------------------------------------------

function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const participantID = getParam("pid");

const submissionUrl =
    "https://dgdflklwjkcndvkvakpp.supabase.co/functions/v1/submit-study";

if (!participantID) {
    document.body.innerHTML =
        "<h2>Participant ID is missing.</h2>";
    throw new Error("Missing participant ID");
}

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
                csv: jsPsych.data.get().csv()
            })
        });

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
// Consent page
// ------------------------------------------

timeline.push(
    loadPage("instructions/consent.html")
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
