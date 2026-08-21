import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
    connectFunctionsEmulator,
    getFunctions,
    httpsCallable
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-functions.js";

const firebaseConfig = {
    apiKey: "AIzaSyBS0BbrlKO13F46Udku0m36xPEuG7pBlRA",
    authDomain: "signlanguage-textsupport-study.firebaseapp.com",
    projectId: "signlanguage-textsupport-study",
    storageBucket: "signlanguage-textsupport-study.firebasestorage.app",
    messagingSenderId: "408495264473",
    appId: "1:408495264473:web:8b8dc36a307a0c44b9e4c8",
    measurementId: "G-1CC8DSHH0Q"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, "us-central1");

if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
) {
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

export const reserveParticipant = httpsCallable(
    functions,
    "reserveParticipant"
);

export const logPrototypeInteraction = httpsCallable(
    functions,
    "logPrototypeInteraction"
);

export const submitStudy = httpsCallable(functions, "submitStudy");
