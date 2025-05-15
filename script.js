import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  onValue,
  onDisconnect,
  set,
  remove,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔐 Tus credenciales
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
const clearBtn = document.getElementById("clear-chat");
const leaveBtn = document.getElementById("leave-chat"); // 👈 nuevo

const adminName = "Andrea";

let userName = null;
let userLang = null;
let targetLang = null;
let roomRef = null;
let lastSender = null;
let userId = null;
let previousUsers = [];

joinBtn.addEventListener("click", async () => {
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

  if (userName === adminName) {
    clearBtn.style.display = "inline-block";
  }

  onChildAdded(roomRef, (snapshot) => {
    const message = snapshot.val();
    renderMessage(message);
  });

  // Presencia
  userId = `${userName}-${Math.random().toString(36).slice(2, 6)}`;
  const presenceRef = ref(db, `presence/${roomCode}/${userId}`);
  await push(presenceRef, { name: userName });
  onDisconnect(presenceRef).remove();

  const presenceRoomRef = ref(db, `presence/${roomCode}`);
  onValue(presenceRoomRef, (snapshot) => {
    const currentUsers = [];

    snapshot.forEach((child) => {
      const val = Object.values(child.val())[0];
      if (val?.name) currentUsers.push(val.name);
    });

    currentUsers.forEach((name) => {
      if (!previousUsers.includes(name) && name !== userName) {
        showSystemMessage(`${name} se ha conectado`);
      }
    });

    previousUsers.forEach((name) => {
      if (!currentUsers.includes(name) && name !== userName) {
        showSystemMessage(`${name} se ha desconectado`);
      }
    });

    previousUsers = currentUsers;
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

// BOTÓN BORRAR CHAT (solo admin)
clearBtn.addEventListener("click", () => {
  if (!roomRef) return;
  const confirmDelete = confirm("¿Seguro que quieres borrar todo el chat?");
  if (!confirmDelete) return;

  set(roomRef, null);
  chatWindow.innerHTML = "";
  showSystemMessage(`💥 ${userName} ha borrado el chat`);
});

// BOTÓN SALIR DEL CHAT (para todos)
leaveBtn.addEventListener("click", async () => {
  const roomCode = roomInput.value.trim();
  if (roomCode && userId) {
    const presenceRef = ref(db, `presence/${roomCode}/${userId}`);
    await remove(presenceRef);
  }

  chatWindow.innerHTML = "";
  chatInput.value = "";
  setupSection.classList.remove("hidden");
  chatSection.classList.add("hidden");
  clearBtn.style.display = "none";
  userName = null;
  userId = null;
  roomRef = null;
  previousUsers = [];
});

// MENSAJE AGRUPADO
function renderMessage({ from, originalText, translatedText, timestamp }) {
  const isCurrentUser = from === userName;
  const side = isCurrentUser ? "right" : "left";

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

  const groups = chatWindow.querySelectorAll(`.message-group.${side}`);
  const lastGroup = groups[groups.length - 1];
  lastGroup.appendChild(messageBubble);

  chatWindow.scrollTop = chatWindow.scrollHeight;
  lastSender = from;
}

// MENSAJE DEL SISTEMA
function showSystemMessage(text) {
  const systemMsg = document.createElement("div");
  systemMsg.className = "system-message";
  systemMsg.textContent = text;
  chatWindow.appendChild(systemMsg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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

// ANIMACIÓN TÍTULO
const h1 = document.getElementById("titulo-wave");
const text = h1.textContent;
h1.textContent = "";

[...text].forEach((char, i) => {
  const span = document.createElement("span");
  span.textContent = char;
  span.style.display = "inline-block";
  span.style.animation = "wave 1.5s ease-in-out infinite";
  span.style.color = i % 2 === 0 ? "#00b451" : "#00401a";
  span.style.animationDelay = `${i * 0.1}s`;
  h1.appendChild(span);
});
