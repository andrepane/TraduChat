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
  off,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDcQfDtysQmIBSW75_KWy5qyXLKQ6X41LU",
  authDomain: "traduchat-47658.firebaseapp.com",
  databaseURL: "https://traduchat-47658-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "traduchat-47658",
  storageBucket: "traduchat-47658.firebasestorage.app",
  messagingSenderId: "77137797935",
  appId: "1:77137797935:web:caa5bf672bcd90448c77da",
  measurementId: "G-XXC1WTYBRP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Función de hash segura con SHA-256
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Elementos del DOM
const usernameInput = document.getElementById("username");
const langSelect = document.getElementById("language-select");
const roomInput = document.getElementById("room-code");
const roomPasswordInput = document.getElementById("room-password");
const joinBtn = document.getElementById("join-room");
const setupSection = document.getElementById("setup");
const chatSection = document.getElementById("chat-section");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-chat");
const leaveBtn = document.getElementById("leave-chat");
const micBtn = document.getElementById("mic-btn");

const typingTimeouts = {};
let translateOwnLang = false;

let userName = null;
let userLang = null;
let targetLang = null;
let roomRef = null;
let userId = null;
let previousUsers = [];

// Al pulsar el botón de entrar
joinBtn.addEventListener("click", async () => {
  const roomCode = roomInput.value.trim();
  const password = roomPasswordInput.value.trim();
  userName = usernameInput.value.trim();
  userLang = langSelect.value;
  targetLang = userLang === "es" ? "it" : "es";
  translateOwnLang = document.getElementById("translate-own-lang").checked;

  if (!roomCode || !password || !userName || !userLang) {
    alert("Por favor, rellena todos los campos.");
    return;
  }

  const hash = await hashPassword(password);
  const salaId = `${roomCode}__${hash}`;
  roomRef = ref(db, `rooms/${salaId}`);
  const creatorRef = ref(db, `creators/${salaId}`);
  const permissionRef = ref(db, `accessPermissions/${salaId}/${userName}`);

  const creatorSnap = await get(creatorRef);
  if (!creatorSnap.exists()) {
    await set(creatorRef, userName);
    await set(permissionRef, true);
  } else {
    const creatorName = creatorSnap.val();
    if (creatorName !== userName) {
      const existingPerm = await get(permissionRef);
      if (!existingPerm.exists()) {
        await set(ref(db, `accessRequests/${salaId}/${userName}`), "pending");
        alert("Esperando aprobación del creador de la sala...");

        const interval = setInterval(async () => {
          const updatedPerm = await get(permissionRef);
          if (updatedPerm.exists()) {
            clearInterval(interval);
            iniciarChat(salaId);
          }
        }, 3000);
        return;
      }
    }
  }

  iniciarChat(salaId);
});

async function iniciarChat(salaId) {
  off(roomRef);
  setupSection.classList.add("hidden");
  chatSection.classList.remove("hidden");
  if (userName === "Andrea") clearBtn.style.display = "inline-block";

  onChildAdded(roomRef, snapshot => renderMessage(snapshot.val()));

  userId = `${userName}-${Math.random().toString(36).slice(2, 6)}`;
  const presenceRef = ref(db, `presence/${salaId}/${userId}`);
  await push(presenceRef, { name: userName });
  onDisconnect(presenceRef).remove();

  onValue(ref(db, `presence/${salaId}`), (snapshot) => {
    const currentUsers = [];
    snapshot.forEach(child => {
      const val = Object.values(child.val())[0];
      if (val?.name) currentUsers.push(val.name);
    });

    currentUsers.forEach(name => {
      if (!previousUsers.includes(name) && name !== userName)
        showSystemMessage(`${name} se ha conectado`);
    });
    previousUsers.forEach(name => {
      if (!currentUsers.includes(name) && name !== userName)
        showSystemMessage(`${name} se ha desconectado`);
    });
    previousUsers = currentUsers;
  });

  onValue(ref(db, `typing/${salaId}`), snapshot => {
    const data = snapshot.val();
    const typingUsers = Object.keys(data || {}).filter(name => data[name] && name !== userName);
    const existing = document.getElementById("typing-indicator");

    if (typingUsers.length > 0) {
      const msg = `${typingUsers.join(", ")} está escribiendo...`;
      if (existing) existing.textContent = msg;
      else {
        const el = document.createElement("div");
        el.id = "typing-indicator";
        el.className = "system-message";
        el.textContent = msg;
        chatWindow.appendChild(el);
      }
    } else if (existing) existing.remove();

    chatWindow.scrollTop = chatWindow.scrollHeight;
  });

  chatInput.addEventListener("input", () => {
    const typingRef = ref(db, `typing/${salaId}/${userName}`);
    set(typingRef, true);
    if (typingTimeouts[userName]) clearTimeout(typingTimeouts[userName]);
    typingTimeouts[userName] = setTimeout(() => set(typingRef, false), 3000);
  });
}

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
    lang: userLang
  });

  chatInput.value = "";
});

clearBtn.addEventListener("click", () => {
  if (!roomRef) return;
  if (confirm("¿Seguro que quieres borrar todo el chat?")) {
    set(roomRef, null);
    chatWindow.innerHTML = "";
    showSystemMessage(`💥 ${userName} ha borrado el chat`);
  }
});

leaveBtn.addEventListener("click", async () => {
  if (!roomRef || !userId) return;
  await remove(ref(db, `presence/${roomRef.key}/${userId}`));
  await set(ref(db, `typing/${roomRef.key}/${userName}`), false);
  chatWindow.innerHTML = "";
  chatInput.value = "";
  setupSection.classList.remove("hidden");
  chatSection.classList.add("hidden");
  clearBtn.style.display = "none";
});

micBtn.addEventListener("click", () => {
  if (!userLang || !roomRef) return alert("Debes entrar en una sala antes de usar el micrófono.");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Tu navegador no soporta reconocimiento de voz.");

  const recognition = new SpeechRecognition();
  recognition.lang = userLang === "es" ? "es-ES" : "it-IT";
  recognition.interimResults = true;

  let finalTranscript = "";
  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
    }
    chatInput.value = finalTranscript;
  };

  recognition.onerror = () => (micBtn.textContent = "🎤");
  recognition.onend = () => (micBtn.textContent = "🎤");

  micBtn.textContent = "🛑 Detener";
  recognition.start();
});

function renderMessage({ from, originalText, translatedText, timestamp, lang }) {
  const isCurrentUser = from === userName;
  const side = isCurrentUser ? "right" : "left";
  const showOriginal = lang === userLang && !translateOwnLang;

  const groups = chatWindow.querySelectorAll(`.message-group.${side}`);
  const lastGroup = groups[groups.length - 1];

  if (!lastGroup || lastGroup.dataset.sender !== from) {
    const meta = document.createElement("div");
    meta.className = `message-group ${side}`;
    meta.dataset.sender = from;

    const nameLine = document.createElement("div");
    nameLine.className = "message-meta";
    nameLine.textContent = `${from} — ${formatTime(timestamp)}`;

    meta.appendChild(nameLine);
    chatWindow.appendChild(meta);
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = showOriginal ? originalText : translatedText;

  chatWindow.querySelector(`.message-group.${side}:last-child`).appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

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
  const encoded = encodeURIComponent(text);
  const url = `https://magicloops.dev/api/loop/1f32ffbd-1eb5-4e1c-ab57-f0a322e5a1c3/run?text=${encoded}&targetLanguage=${targetLang}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data.translatedText || "[Sin traducción]";
  } catch (err) {
    console.error("Error de traducción:", err);
    return "[Error de traducción]";
  }
}
