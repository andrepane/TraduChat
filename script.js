import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔐 Rellena con tus datos reales
const firebaseConfig = {
  apiKey: "AIzaSyDcQfDtysQmIBSW75_KWy5qyXLKQ6X41LU",
  authDomain: "traduchat-47658.firebaseapp.com",
  databaseURL:
    "https://traduchat-47658-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "traduchat-47658",
  storageBucket: "traduchat-47658.firebasestorage.app",
  messagingSenderId: "77137797935",
  appId: "1:77137797935:web:caa5bf672bcd90448c77da",
  measurementId: "G-XXC1WTYBRP",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ELEMENTOS
const usernameInput = document.getElementById("username");
const langSelect = document.getElementById("language-select");
const roomInput = document.getElementById("room-code");
const joinBtn = document.getElementById("join-room");
const setupSection = document.getElementById("setup");
const chatSection = document.getElementById("chat-section");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

let userName = null;
let userLang = null;
let targetLang = null;
let roomRef = null;
let lastSender = null;

// ENTRAR A LA SALA
joinBtn.addEventListener("click", () => {
  const roomCode = roomInput.value.trim();
  userName = usernameInput.value.trim();
  userLang = langSelect.value;
  targetLang = userLang === "es" ? "it" : "es";

  if (!roomCode || !userLang || !userName) {
    alert("Por favor, rellena todos los campos.");
    return;
  }

  roomRef = ref(db, "rooms/" + roomCode);
  setupSection.classList.add("hidden");
  chatSection.classList.remove("hidden");

  onChildAdded(roomRef, (snapshot) => {
    const message = snapshot.val();
    renderMessage(message);
  });
});

// ENVIAR MENSAJE
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !roomRef) return;

  const translatedText = await translateText(text, targetLang);
  const timestamp = Date.now();

  push(roomRef, {
    from: userName,
    originalText: text,
    translatedText,
    timestamp,
  });

  chatInput.value = "";
});

// MOSTRAR MENSAJE AGRUPADO
function renderMessage({ from, originalText, translatedText, timestamp }) {
  const isCurrentUser = from === userName;
  const side = isCurrentUser ? "right" : "left";

  // Agrupar si es el mismo remitente que el anterior
  if (lastSender !== from) {
    const meta = document.createElement("div");
    meta.className = `message-group ${side}`;

    const nameLine = document.createElement("div");
    nameLine.className = "message-meta";
    nameLine.textContent = `${from} — ${formatTime(timestamp)}`;

    meta.appendChild(nameLine);
    chatWindow.appendChild(meta);
  }

  const messageBubble = document.createElement("div");
  messageBubble.className = "message-bubble";
  messageBubble.textContent = translatedText;

  // Insertar en el último grupo del mismo lado
  const groups = chatWindow.querySelectorAll(`.message-group.${side}`);
  const lastGroup = groups[groups.length - 1];
  lastGroup.appendChild(messageBubble);

  chatWindow.scrollTop = chatWindow.scrollHeight;
  lastSender = from;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// TRADUCCIÓN
async function translateText(text, targetLang) {
  const encodedText = encodeURIComponent(text);
  const url = `https://magicloops.dev/api/loop/1f32ffbd-1eb5-4e1c-ab57-f0a322e5a1c3/run?text=${encodedText}&targetLanguage=${targetLang}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.translatedText || "[Sin traducción]";
  } catch (error) {
    console.error("Error de traducción:", error);
    return "[Error de traducción]";
  }
}
