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
  push,
  get
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

// 🔁 Mostrar salas
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

// 📦 Cargar salas y también rellenar el select para el mensaje global
const selectGlobal = document.createElement("select");
selectGlobal.id = "select-destino";
selectGlobal.style.marginTop = "2rem";
selectGlobal.style.padding = "0.5rem";
selectGlobal.style.fontSize = "1rem";

const textareaGlobal = document.createElement("textarea");
textareaGlobal.placeholder = "Mensaje global del admin...";
textareaGlobal.rows = 3;
textareaGlobal.style.width = "100%";
textareaGlobal.style.marginTop = "0.5rem";
textareaGlobal.style.padding = "0.5rem";
textareaGlobal.style.fontSize = "1rem";

const botonGlobal = document.createElement("button");
botonGlobal.textContent = "📢 Enviar mensaje";
botonGlobal.style.marginTop = "0.5rem";

document.body.appendChild(document.createElement("hr"));
document.body.appendChild(selectGlobal);
document.body.appendChild(textareaGlobal);
document.body.appendChild(botonGlobal);

// Rellenar el select con las salas
onValue(ref(db, "rooms"), (snapshot) => {
  contenedor.innerHTML = "";
  selectGlobal.innerHTML = "";

  const data = snapshot.val();
  if (!data) {
    contenedor.textContent = "No hay salas activas.";
    return;
  }

  const opcionTodas = document.createElement("option");
  opcionTodas.value = "ALL";
  opcionTodas.textContent = "🌐 Todas las salas";
  selectGlobal.appendChild(opcionTodas);

  Object.keys(data).forEach((salaId) => {
    crearTarjeta(salaId);

    const option = document.createElement("option");
    option.value = salaId;
    option.textContent = salaId;
    selectGlobal.appendChild(option);
  });
});

// ✉️ Enviar mensaje global
botonGlobal.addEventListener("click", async () => {
  const texto = textareaGlobal.value.trim();
  const destino = selectGlobal.value;
  if (!texto) return alert("Escribe un mensaje primero.");

push(ref(db, `rooms/${salaId}`), {
  from: "ADMIN",
  originalText: mensaje,
  translatedText: mensaje,
  timestamp: Date.now(),
  lang: "admin",
  tipo: "global"
});


  if (destino === "ALL") {
    const snapshot = await get(ref(db, "rooms"));
    if (snapshot.exists()) {
      Object.keys(snapshot.val()).forEach((salaId) => {
        push(ref(db, `rooms/${salaId}`), mensaje);
      });
    }
  } else {
    push(ref(db, `rooms/${destino}`), mensaje);
  }

  textareaGlobal.value = "";
  alert("Mensaje enviado correctamente.");
});
