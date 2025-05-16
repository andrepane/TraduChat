import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  remove
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
const table = document.getElementById("room-table");
const presenceRef = ref(db, "presence");

onValue(presenceRef, (snapshot) => {
  table.innerHTML = "";
  snapshot.forEach((roomSnap) => {
    const salaId = roomSnap.key;
    let userCount = 0;

    roomSnap.forEach((userSnap) => {
      const userObj = userSnap.val();
      if (userObj?.name) userCount++;
    });

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${salaId}</td>
      <td>${userCount}</td>
      <td><button class="delete" onclick="deleteRoom('${salaId}')">Eliminar sala</button></td>
    `;
    table.appendChild(row);
  });
});

window.deleteRoom = async (salaId) => {
  const confirmDelete = confirm(`¿Eliminar completamente la sala \"${salaId}\"?`);
  if (!confirmDelete) return;
  await remove(ref(db, `rooms/${salaId}`));
  await remove(ref(db, `presence/${salaId}`));
  await remove(ref(db, `typing/${salaId}`));
  alert("Sala eliminada.");
};
