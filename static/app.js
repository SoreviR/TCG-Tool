const MAX_IMAGES = 20;

let selectedFiles = [];
let sessionId = null;

let lang = localStorage.getItem("lang") || "es";
let theme = localStorage.getItem("theme") || "dark";

/* I18N */
const dict = {
  es: {
    processBtn: "Procesar cartas",
    download: "Descargar imágenes",
  },
  en: {
    processBtn: "Process cards",
    download: "Download images",
  },
};

function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerText = dict[lang][el.dataset.i18n];
  });
  document.getElementById("langToggle").innerText = lang.toUpperCase();
}

function applyTheme() {
  document.body.classList.toggle("light", theme === "light");
  document.getElementById("themeToggle").innerText =
    theme === "light" ? "🌙" : "☀️";
}

/* NAVBAR */
const binder = document.getElementById("binder");
const menuToggle = document.getElementById("menuToggle");

menuToggle.onclick = () => {
  binder.classList.toggle("open");
};

/* FILE HANDLING */
const preview = document.getElementById("preview");
const fileInput = document.getElementById("files");
const dropzone = document.getElementById("dropzone");

function updatePreview() {
  preview.innerHTML = "";
  selectedFiles.forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
}

function addFiles(files) {
  for (let file of files) {
    if (selectedFiles.length >= MAX_IMAGES) break;
    selectedFiles.push(file);
  }
  updatePreview();
}

dropzone.onclick = () => fileInput.click();

dropzone.ondrop = (e) => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
};

dropzone.ondragover = (e) => e.preventDefault();

fileInput.onchange = () => {
  addFiles(fileInput.files);
  fileInput.value = "";
};

/* PROCESS BUTTON — FIX PRINCIPAL */
document.getElementById("startBtn").onclick = async () => {
  if (selectedFiles.length < 2 || selectedFiles.length % 2 !== 0) {
    alert("Debes subir imágenes en pares (front/back).");
    return;
  }

  const formData = new FormData();
  selectedFiles.forEach((f) => formData.append("files", f));

  const res = await fetch("/process", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  sessionId = data.session_id;

  document.getElementById("download").href = `/download/${sessionId}`;
  document.getElementById("download").style.display = "block";
};

/* RESET */
document.getElementById("resetBtn").onclick = () => {
  selectedFiles = [];
  sessionId = null;
  preview.innerHTML = "";
  document.getElementById("download").style.display = "none";
};

/* INIT */
applyLang();
applyTheme();
