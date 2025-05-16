// 🔐 Verifica que tenga acceso como admin
if (sessionStorage.getItem("isAdmin") !== "true") {
  alert("Acceso denegado");
  location.href = "index.html";
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  remove,
  push
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
const contenedor = document.getElementById("sala-lista");

function extraerNombreSala(salaId) {
  return salaId.split("__")[0];
}

function crearTarjeta(salaId) {
  const nombreSala = extraerNombreSala(salaId);
  const div = document.createElement("div");
  div.className = "sala-card";

  const titulo = document.createElement("h2");
  titulo.textContent = `🟢 Sala: ${nombreSala}`;
  div.appendChild(titulo);

  const contador = document.createElement("p");
  contador.style.fontSize = "0.9rem";
  contador.style.marginTop = "0.2rem";
  div.appendChild(contador);

  const salaPresenceRef = ref(db, `presence/${salaId}`);
  onValue(salaPresenceRef, (snap) => {
    const users = [];
    snap.forEach((child) => {
      const user = Object.values(child.val())[0];
      if (user?.name) users.push(user.name);
    });
    contador.textContent = `👥 Conectados: ${users.length} — ${users.join(", ") || "Ninguno"}`;
  });

  const btnEntrar = document.createElement("button");
  btnEntrar.textContent = "Entrar como admin";
  btnEntrar.addEventListener("click", () => {
    const nombre = prompt("Tu nombre de usuario:");
    const idioma = prompt("Idioma (es o it):");
    const clave = prompt("Contraseña de la sala:");

    if (!nombre || !clave || !idioma) {
      alert("Faltan datos.");
      return;
    }

    sessionStorage.setItem("admin-autologin", JSON.stringify({
      username: nombre,
      roomCode: nombreSala,
      password: clave,
      lang: idioma,
      isAdmin: true
    }));
    window.open("index.html", "_blank");
  });
  div.appendChild(btnEntrar);

  const btnBorrar = document.createElement("button");
  btnBorrar.textContent = "🗑 Borrar mensajes";
  btnBorrar.className = "danger";
  btnBorrar.addEventListener("click", () => {
    if (confirm(`¿Borrar todos los mensajes de la sala "${nombreSala}"?`)) {
      remove(ref(db, `rooms/${salaId}`));
    }
  });
  div.appendChild(btnBorrar);

  const btnCerrar = document.createElement("button");
  btnCerrar.textContent = "🚪 Cerrar sala";
  btnCerrar.className = "danger";
  btnCerrar.addEventListener("click", () => {
    if (confirm(`¿Cerrar completamente la sala "${nombreSala}" (incluye usuarios y escritura)?`)) {
      remove(ref(db, `rooms/${salaId}`));
      remove(ref(db, `presence/${salaId}`));
      remove(ref(db, `typing/${salaId}`));
    }
  });
  div.appendChild(btnCerrar);

  contenedor.appendChild(div);
}

// Mostrar salas activas
onValue(ref(db, "rooms"), (snapshot) => {
  contenedor.innerHTML = "";
  const data = snapshot.val();
  if (!data) {
    contenedor.textContent = "No hay salas activas.";
    return;
  }

  Object.keys(data).forEach((salaId) => crearTarjeta(salaId));
});

// ✅ Formulario de mensaje global
const msgContainer = document.createElement("div");
msgContainer.style.margin = "2rem 1rem";
msgContainer.innerHTML = `
  <h3>✉️ Enviar mensaje global</h3>
  <select id="sala-select" style="margin-bottom: 0.5rem; padding: 0.5rem;"></select>
  <textarea id="mensaje-global" rows="3" placeholder="Escribe el mensaje..." style="width: 100%; padding: 0.5rem;"></textarea>
  <button id="enviar-global" style="margin-top: 0.5rem;">Enviar mensaje</button>
`;
document.body.appendChild(msgContainer);

const salaSelect = document.getElementById("sala-select");
const mensajeInput = document.getElementById("mensaje-global");
const enviarBtn = document.getElementById("enviar-global");

// Rellenar select de salas
onValue(ref(db, "rooms"), (snapshot) => {
  salaSelect.innerHTML = `<option value="ALL">🌐 Todas las salas</option>`;
  snapshot.forEach((sala) => {
    const option = document.createElement("option");
    option.value = sala.key;
    option.textContent = sala.key;
    salaSelect.appendChild(option);
  });
});

enviarBtn.addEventListener("click", async () => {
  const texto = mensajeInput.value.trim();
  const destino = salaSelect.value;
  if (!texto) return alert("Escribe un mensaje primero.");

  const mensaje = {
    from: "ADMIN",
    originalText: texto,
    translatedText: texto,
    timestamp: Date.now(),
    lang: "es"
  };

  if (destino === "ALL") {
    const snap = await onValue(ref(db, "rooms"), () => {});
    Object.keys(snap.val() || {}).forEach((salaId) => {
      push(ref(db, `rooms/${salaId}`), mensaje);
    });
  } else {
    push(ref(db, `rooms/${destino}`), mensaje);
  }

  mensajeInput.value = "";
  alert("Mensaje enviado.");
});
