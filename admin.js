import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  get
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcQfDtysQmIBSW75_KWy5qyXLKQ6X41LU",
  authDomain: "traduchat-47658.firebaseapp.com",
  databaseURL: "https://traduchat-47658-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "traduchat-47658",
  storageBucket: "traduchat-47658.appspot.com",
  messagingSenderId: "77137797935",
  appId: "1:77137797935:web:caa5bf672bcd90448c77da"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const container = document.getElementById("sala-lista");

onValue(ref(db, "presence"), async (snapshot) => {
  container.innerHTML = "";
  if (!snapshot.exists()) {
    container.textContent = "No hay salas activas.";
    return;
  }

  const salas = snapshot.val();
  for (const salaId in salas) {
    const users = Object.values(salas[salaId]).map(u => Object.values(u)[0]?.name || "Desconocido");
    const [roomCode] = salaId.split("__");

    const salaDiv = document.createElement("div");
    salaDiv.className = "sala";
    salaDiv.innerHTML = `
      <h2>Sala: <strong>${roomCode}</strong></h2>
      <p>Usuarios conectados: ${users.length}</p>
      <p>${users.join(", ")}</p>
      <button onclick="abrirSala('${roomCode}')">Entrar</button>
    `;
    container.appendChild(salaDiv);
  }
});

window.abrirSala = function (roomCode) {
  const pwd = prompt(`Introduce la contraseña para la sala "${roomCode}"`);
  if (!pwd) return;
  sessionStorage.setItem("autoRoom", JSON.stringify({ code: roomCode, pass: pwd }));
  window.location.href = "index.html";
};
