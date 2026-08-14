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

        on_finish: (data) => {
            const participantID =
                data.response.participant_id?.trim();

            if (participantID) {
                window.location.href =
                    `experiment.html?pid=${encodeURIComponent(participantID)}`;
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
