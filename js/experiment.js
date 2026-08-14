// ------------------------------------------
// Read Participant ID
// ------------------------------------------

function getParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

const participantID = getParam("pid");

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

    on_finish: () => {

        jsPsych.data.get().localSave(
            "csv",
            `participant_${participantID}.csv`
        );

    }

});

// ------------------------------------------
// Timeline
// ------------------------------------------

const timeline = [];

// ------------------------------------------
// Helper function
// ------------------------------------------

function loadPage(url, executeScript = false) {

    return {

        type: jsPsychExternalHtml,

        url: url,

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
    loadPage("instructions/consent.html", true)
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
