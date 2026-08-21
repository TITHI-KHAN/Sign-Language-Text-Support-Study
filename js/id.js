import { reserveParticipant } from "./firebase.js";

const jsPsych = initJsPsych();

jsPsych.run([
    {
        type: jsPsychSurveyText,

        questions: [
            {
                prompt: "Please enter your participant ID:",
                name: "participant_id",
                required: true
            }
        ],

        button_label: "Continue",

        on_finish: async (data) => {
            const participantID =
                data.response.participant_id?.trim();

            if (participantID) {
                const sessionID = crypto.randomUUID();
                const submitButton = document.querySelector(
                    ".jspsych-btn"
                );

                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = "Checking ID…";
                }

                try {
                    await reserveParticipant({
                        participantId: participantID,
                        sessionId: sessionID
                    });

                    sessionStorage.setItem(
                        "study_session_id",
                        sessionID
                    );

                    window.location.href =
                        `experiment.html?pid=${encodeURIComponent(participantID)}`;
                } catch (error) {
                    console.error(error);

                    if (error.code === "functions/already-exists") {
                        alert(
                            "This participant ID has already been used. " +
                            "Please ask the researcher for help."
                        );
                    } else {
                        alert(
                            "We could not verify this participant ID. " +
                            "Please try again or ask the researcher for help."
                        );
                    }

                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = "Continue";
                    }
                }
            } else {
                alert("Participant ID is required.");
            }
        },

        on_load: () => {
            const input = document.querySelector(
                '.jspsych-survey-text-question input'
            );

            if (input) {
                input.classList.add('form-control');
            }

            const wrapper = document.querySelector(
                '.jspsych-survey-text-question'
            );

            if (wrapper) {
                wrapper.classList.add('mb-3');
            }
        }
    }
]);
