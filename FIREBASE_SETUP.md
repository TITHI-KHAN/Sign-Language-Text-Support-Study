# Firebase study backend

The study uses Firebase Cloud Functions, Cloud Firestore, and Cloud Storage.
Participant IDs are normalized to lowercase and reserved atomically before the
study begins. Final CSV files are private and cannot be read or written directly
from browser code.

## Firebase console setup

In the `signlanguage-textsupport-study` Firebase project:

1. Enable Cloud Firestore in production mode.
2. Enable Cloud Storage.
3. Confirm that the registered web app uses the configuration in
   `js/firebase.js`.

Do not put a service-account key in this repository. Cloud Functions receive
their Firebase Admin credentials from the deployed environment.

## Deploy

Install and authenticate the Firebase CLI, then deploy from the repository
root:

```sh
npx firebase-tools login
npx firebase-tools use signlanguage-textsupport-study
npx firebase-tools deploy --only functions,firestore:rules,storage
```

The deployment creates these callable functions in `us-central1`:

- `reserveParticipant`
- `logPrototypeInteraction`
- `submitStudy`

## Data layout

- `participants/<normalized-id>` stores the reservation and submission state.
- `prototypeInteractions/<session-id>_<sequence>` stores one meaningful action.
- `study-responses/participant_<normalized-id>.csv` stores the final jsPsych CSV.

Firestore and Storage rules deny all direct browser access. All writes go
through validated Cloud Functions.

## Prototype event contract

The study opens the prototype with `pid` and `session` query parameters. The
prototype must send meaningful actions to its opener:

```js
window.opener?.postMessage({
  type: "prototype-interaction",
  interaction: {
    action: "feature_selected",
    feature: "segmentation",
    value: "sentence",
    occurred_at: new Date().toISOString(),
    state: {
      location: currentLocation,
      segmentation: currentMode,
      linking_granularity: currentLinkingGranularity,
      navigation: currentNavigation
    }
  }
}, "https://tithi-khan.github.io");
```

Instrument deliberate actions only: sidebar open/close, feature selections,
text-unit selections, video play/pause/seek/close, and previous/next segment.
Do not send mouse movement, hover, continuous scrolling, resize movement, or
continuous video `timeupdate` events.

## Test before recruitment

1. Open the published study and enter a new test ID.
2. Confirm a `reserved` participant document is created.
3. Use the prototype and confirm ordered interaction documents appear.
4. Finish the study and confirm the participant becomes `submitted` and the
   private CSV appears in Storage.
5. Enter a case variant of the same ID and confirm it is rejected immediately.
