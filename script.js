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
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// 🔐 Tus credenciales
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

const typingRef = ref(db, "typing");
const typingTimeouts = {};
let translateOwnLang = false;

// ELEMENTOS
const usernameInput = document.getElementById("username");
const langSelect = document.getElementById("language-select");
const roomInput = document.getElementById("room-code");
const joinBtn = document.getElementById("join-room");
const roomPasswordInput = document.getElementById("room-password");
const setupSection = document.getElementById("setup");
const chatSection = document.getElementById("chat-section");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-chat");
const leaveBtn = document.getElementById("leave-chat");
const micBtn = document.getElementById("mic-btn");

const adminName = "Andrea";

let userName = null;
let userLang = null;
let targetLang = null;
let roomRef = null;
let lastSender = null;
let userId = null;
let previousUsers = [];

// Utilidad para combinar código y contraseña
function hashPassword(pwd) {
  let hash = 0;
  for (let i = 0; i < pwd.length; i++) {
    hash = (hash << 5) - hash + pwd.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString();
}

chatInput.addEventListener("input", () => {
  if (!roomRef || !userName) return;
  const userTypingRef = ref(db, `typing/${roomRef.key}/${userName}`);
  set(userTypingRef, true);
  if (typingTimeouts[userName]) clearTimeout(typingTimeouts[userName]);
  typingTimeouts[userName] = setTimeout(() => {
    set(userTypingRef, false);
  }, 3000);
});

joinBtn.addEventListener("click", async () => {
  const roomCode = roomInput.value.trim();
  const password = roomPasswordInput.value.trim();
  userName = usernameInput.value.trim();
  userLang = langSelect.value;
  targetLang = userLang === "es" ? "it" : "es";

  translateOwnLang = document.getElementById("translate-own-lang").checked;

  if (!roomCode || !userLang || !userName || !password) {
    alert("Por favor, rellena todos los campos.");
    return;
  }

  const salaId = `${roomCode}__${hashPassword(password)}`;
  roomRef = ref(db, "rooms/" + salaId);

  off(roomRef);
  setupSection.classList.add("hidden");
  chatSection.classList.remove("hidden");

  if (userName === adminName) clearBtn.style.display = "inline-block";

  onChildAdded(roomRef, (snapshot) => {
    const message = snapshot.val();
    renderMessage(message);
  });

  userId = `${userName}-${Math.random().toString(36).slice(2, 6)}`;
  const presenceRef = ref(db, `presence/${salaId}/${userId}`);
  await push(presenceRef, { name: userName });
  onDisconnect(presenceRef).remove();

  const presenceRoomRef = ref(db, `presence/${salaId}`);
  onValue(presenceRoomRef, (snapshot) => {
    const currentUsers = [];
    snapshot.forEach((child) => {
      const val = Object.values(child.val())[0];
      if (val?.name) currentUsers.push(val.name);
    });
    currentUsers.forEach((name) => {
      if (!previousUsers.includes(name) && name !== userName)
        showSystemMessage(`${name} se ha conectado`);
    });
    previousUsers.forEach((name) => {
      if (!currentUsers.includes(name) && name !== userName)
        showSystemMessage(`${name} se ha desconectado`);
    });
    previousUsers = currentUsers;
  });

  const typingRoomRef = ref(db, `typing/${salaId}`);
  onValue(typingRoomRef, (snapshot) => {
    const data = snapshot.val();
    const typingUsers = Object.keys(data || {}).filter(
      (name) => data[name] && name !== userName
    );
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
});

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
  resetInput();
});

clearBtn.addEventListener("click", () => {
  if (!roomRef) return;
  if (!confirm("¿Seguro que quieres borrar todo el chat?")) return;
  set(roomRef, null);
  chatWindow.innerHTML = "";
  showSystemMessage(`💥 ${userName} ha borrado el chat`);
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
  userName = null;
  userId = null;
  roomRef = null;
  previousUsers = [];
});

let isRecording = false;
let finalTranscript = "";
let recognition = null;

micBtn.addEventListener("click", () => {
  if (!userLang || !roomRef) {
    alert("Debes entrar en una sala antes de usar el micrófono.");
    return;
  }
  if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
    alert("Tu navegador no soporta reconocimiento de voz.");
    return;
  }
  if (isRecording && recognition) {
    recognition.stop();
    return;
  }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.lang = userLang === "es" ? "es-ES" : "it-IT";
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  finalTranscript = "";
  isRecording = true;
  micBtn.textContent = "🛑 Detener";
  recognition.onresult = (event) => {
    let interimTranscript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interimTranscript += transcript;
    }
    chatInput.value = finalTranscript + interimTranscript;
  };
  recognition.onerror = (e) => {
    console.error("Error de voz:", e.error);
    isRecording = false;
    micBtn.textContent = "🎤";
  };
  recognition.onnomatch = () => {
    console.warn("No se reconoció la voz.");
    isRecording = false;
    micBtn.textContent = "🎤";
  };
  recognition.onend = () => {
    isRecording = false;
    micBtn.textContent = "🎤";
    chatInput.value = finalTranscript || chatInput.value;
  };
  recognition.start();
});

function renderMessage({ from, originalText, translatedText, timestamp, lang }) {
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
  const isSameLang = lang === userLang;
  messageBubble.textContent = (isSameLang && !translateOwnLang) ? originalText : translatedText;
  const groups = chatWindow.querySelectorAll(`.message-group.${side}`);
  const lastGroup = groups[groups.length - 1];
  lastGroup.appendChild(messageBubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  lastSender = from;
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

function resetInput() {
  chatInput.value = "";
  micBtn.textContent = "🎤";
}

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

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("service-worker.js")
    .then(() => console.log("✅ Service worker registrado"))
    .catch((err) => console.error("❌ Error al registrar service worker:", err));
}
