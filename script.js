import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  onDisconnect,
  set,
  remove,
  off
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcQfDtysQmIBSW75_KWy5qyXLKQ6X41LU",
  authDomain: "traduchat-47658.firebaseapp.com",
  databaseURL: "https://traduchat-47658-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "traduchat-47658",
  storageBucket: "traduchat-47658.appspot.com",
  messagingSenderId: "77137797935",
  appId: "1:77137797935:web:caa5bf672bcd90448c77da",
  measurementId: "G-XXC1WTYBRP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const typingTimeouts = {};
let translateOwnLang = true;
let userName = null;
let userLang = null;
let targetLang = null;
let roomRef = null;
let lastSender = null;
let userId = null;
let previousUsers = [];

const usernameInput = document.getElementById("username");
const langSelect = document.getElementById("language-select");
const roomInput = document.getElementById("room-code");
const roomPasswordInput = document.getElementById("room-password");
const translateCheckbox = document.getElementById("translate-own-lang");
translateCheckbox.checked = true;

const joinBtn = document.getElementById("join-room");
const setupSection = document.getElementById("setup");
const chatSection = document.getElementById("chat-section");
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const clearBtn = document.getElementById("clear-chat");
const leaveBtn = document.getElementById("leave-chat");
const micBtn = document.getElementById("mic-btn");

async function hashPassword(pwd) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pwd);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

async function entrarAlChat() {
  const roomCode = roomInput.value.trim();
  const password = roomPasswordInput.value.trim();
  userName = usernameInput.value.trim();
  userLang = langSelect.value;
  targetLang = userLang === "es" ? "it" : "es";
  translateOwnLang = translateCheckbox.checked;

  if (!roomCode || !userLang || !userName || !password) {
    alert("Por favor, rellena todos los campos.");
    return;
  }

  const salaId = `${roomCode}__${await hashPassword(password)}`;
  if (roomRef) off(roomRef);
  roomRef = ref(db, `rooms/${salaId}`);

  setupSection.classList.add("hidden");
  chatSection.classList.remove("hidden");

  const adminBtn = document.getElementById("admin-access");
  if (adminBtn) adminBtn.style.display = "none";

  const esAdmin = sessionStorage.getItem("isAdmin") === "true";
  clearBtn.style.display = esAdmin ? "inline-block" : "none";

  onValue(roomRef, (snapshot) => {
    chatWindow.innerHTML = "";
    lastSender = null;
    snapshot.forEach((child) => {
      const msg = child.val();
      if (msg?.from && msg?.translatedText) renderMessage(msg);
    });
  });

  userId = `${userName}-${Math.random().toString(36).slice(2, 6)}`;
  const presenceRef = ref(db, `presence/${salaId}/${userId}`);
  await push(presenceRef, { name: userName });
  onDisconnect(presenceRef).remove();

  onValue(ref(db, `presence/${salaId}`), (snapshot) => {
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

  onValue(ref(db, `typing/${salaId}`), (snapshot) => {
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
}

joinBtn.addEventListener("click", () => {
  sessionStorage.removeItem("isAdmin");
  entrarAlChat();
});

chatInput.addEventListener("input", () => {
  if (!roomRef || !roomRef.key || !userName) return;
  const userTypingRef = ref(db, `typing/${roomRef.key}/${userName}`);
  set(userTypingRef, true);
  if (typingTimeouts[userName]) clearTimeout(typingTimeouts[userName]);
  typingTimeouts[userName] = setTimeout(() => {
    set(userTypingRef, false);
  }, 3000);
});

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text || !roomRef || !roomRef.key) return;
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
  if (roomRef && confirm("¿Seguro que quieres borrar todo el chat?")) {
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
  userName = null;
  userId = null;
  roomRef = null;
  previousUsers = [];

  const adminBtn = document.getElementById("admin-access");
  if (adminBtn) adminBtn.style.display = "block";
});

let isRecording = false;
let finalTranscript = "";
let recognition = null;

micBtn.addEventListener("click", () => {
  if (!userLang || !roomRef) return alert("Entra en una sala primero");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert("Tu navegador no soporta voz.");

  if (isRecording && recognition) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = userLang === "es" ? "es-ES" : "it-IT";
  recognition.interimResults = true;
  finalTranscript = "";
  isRecording = true;
  micBtn.textContent = "🛑 Detener";

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += t;
      else interim += t;
    }
    chatInput.value = finalTranscript + interim;
  };

  recognition.onerror = recognition.onnomatch = recognition.onend = () => {
    isRecording = false;
    micBtn.textContent = "🎤";
  };

  recognition.start();
});

function renderMessage({ from, originalText, translatedText, timestamp, lang }) {
  if (lang === "admin" && from === "ADMIN") {
    const global = document.createElement("div");
    global.className = "mensaje-global";
    global.textContent = `[ADMIN] ${translatedText}`;
    chatWindow.appendChild(global);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    return;
  }

  const isCurrentUser = from === userName;
  const side = isCurrentUser ? "right" : "left";
  const showOriginal = lang === userLang && !translateOwnLang;

  if (lastSender !== from) {
    const meta = document.createElement("div");
    meta.className = `message-group ${side}`;
    const nameLine = document.createElement("div");
    nameLine.className = "message-meta";
    nameLine.textContent = `${from} — ${formatTime(timestamp)}`;
    meta.appendChild(nameLine);
    chatWindow.appendChild(meta);
    lastSender = from;
  }

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = showOriginal ? originalText : translatedText;
  const groups = chatWindow.querySelectorAll(`.message-group.${side}`);
  const lastGroup = groups[groups.length - 1];
  if (lastGroup) lastGroup.appendChild(bubble);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showSystemMessage(text) {
  const msg = document.createElement("div");
  msg.className = "system-message";
  msg.textContent = text;
  chatWindow.appendChild(msg);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
  navigator.serviceWorker.register("service-worker.js").then(() =>
    console.log("✅ Service worker registrado")
  );
}

const adminHash = "62e081a1ce819dfdbb7d46d0beb86f1d8c20f1df846b3a2879cd78bfba2479fa";

document.getElementById("admin-access").addEventListener("click", async () => {
  const input = prompt("Introduce el código secreto de administrador:");
  if (!input) return;

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const inputHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  if (inputHash === adminHash) {
    sessionStorage.setItem("isAdmin", "true");
    window.location.assign("admin.html");
  } else {
    alert("Código incorrecto");
  }
});

const autolog = sessionStorage.getItem("admin-autologin");
if (autolog) {
  try {
    const { username, roomCode, password, lang } = JSON.parse(autolog);
    usernameInput.value = username;
    roomInput.value = roomCode;
    roomPasswordInput.value = password;
    langSelect.value = lang;
    sessionStorage.removeItem("admin-autologin");
    sessionStorage.setItem("isAdmin", "true");
    setTimeout(() => entrarAlChat(), 100);
  } catch (err) {
    console.error("❌ Auto-login error:", err);
  }
}
