const MAX_IMAGES = 20;

let selectedFiles = [];
let sessionId = null;

let lang = localStorage.getItem("lang") || "es";
let theme = localStorage.getItem("theme") || "dark";

/* I18N */
const dict = {
  es: {
    process: "Procesar",
    how: "Cómo funciona",
    about: "Acerca",
    title: "Preparar cartas para Cardmarket",
    subtitle: "Sube tus fotos y genera imágenes listas para vender.",
    info: "• Se recortará un marco de 5mm\n• Las imágenes deben subirse en pares (Front / Back)",
    drop: "Arrastra aquí tus imágenes",
    processBtn: "Procesar cartas",
    download: "Descargar imágenes",
    footer: "Hecho para coleccionistas",
    tcg: "Tipo de TCG",
    reset: "Resetear herramienta",
  },
  en: {
    process: "Process",
    how: "How it works",
    about: "About",
    title: "Prepare cards for Cardmarket",
    subtitle: "Upload photos and generate ready-to-sell images.",
    info: "• A 5mm border will be cropped\n• Images must be uploaded in pairs",
    drop: "Drag your images here",
    processBtn: "Process cards",
    download: "Download images",
    footer: "Made for collectors",
    tcg: "TCG Type",
    reset: "Reset tool",
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
document.getElementById("menuToggle").onclick = () => {
  document.getElementById("binder").classList.toggle("open");
};

document.getElementById("themeToggle").onclick = () => {
  theme = theme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", theme);
  applyTheme();
};

document.getElementById("langToggle").onclick = () => {
  lang = lang === "es" ? "en" : "es";
  localStorage.setItem("lang", lang);
  applyLang();
};

/* FILE HANDLING */
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("files");
const preview = document.getElementById("preview");

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

dropzone.ondragover = (e) => {
  e.preventDefault();
};

dropzone.ondrop = (e) => {
  e.preventDefault();
  addFiles(e.dataTransfer.files);
};

fileInput.onchange = () => {
  addFiles(fileInput.files);
  fileInput.value = "";
};

/* RESET */
document.getElementById("resetBtn").onclick = () => {
  selectedFiles = [];
  sessionId = null;
  preview.innerHTML = "";
  document.getElementById("progressFill").style.width = "0%";
  document.getElementById("progressText").innerText = "0%";
  document.getElementById("download").style.display = "none";
};

/* INIT */
applyLang();
applyTheme();
