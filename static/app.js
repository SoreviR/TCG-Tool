const MAX_IMAGES = 20;

let selectedFiles = [];
let sessionId = null;

let lang = localStorage.getItem("lang") || "es";
let theme = localStorage.getItem("theme") || "dark";

/* I18N */
const dict = {
  es: {
    title: "Procesador de Cartas TCG",
    description:
      "Sube imágenes en pares (front/back). Se recortará automáticamente un marco de 5mm.",
    dropzone: "Arrastra imágenes aquí o haz click para seleccionarlas",
    process: "Procesar cartas",
    reset: "Resetear",
    download: "Descargar imágenes",
    nav_tool: "Herramienta",
    nav_about: "Acerca de",
  },
  en: {
    title: "TCG Card Processor",
    description:
      "Upload images in pairs (front/back). A 5mm border will be cropped automatically.",
    dropzone: "Drag & drop images here or click to select",
    process: "Process cards",
    reset: "Reset",
    download: "Download images",
    nav_tool: "Tool",
    nav_about: "About",
  },
};

function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerText = dict[lang][el.dataset.i18n];
  });
  document.getElementById("langToggle").innerText = lang.toUpperCase();
  localStorage.setItem("lang", lang);
}

function applyTheme() {
  document.body.classList.toggle("light", theme === "light");
  document.getElementById("themeToggle").innerText =
    theme === "light" ? "🌙" : "☀️";
  localStorage.setItem("theme", theme);
}

/* NAVBAR */
const binder = document.getElementById("binder");
document.getElementById("menuToggle").onclick = () => {
  binder.classList.toggle("open");
};

document.getElementById("langToggle").onclick = () => {
  lang = lang === "es" ? "en" : "es";
  applyLang();
};

document.getElementById("themeToggle").onclick = () => {
  theme = theme === "dark" ? "light" : "dark";
  applyTheme();
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

/* PROCESS */
document.getElementById("startBtn").onclick = async () => {
  if (selectedFiles.length < 2 || selectedFiles.length % 2 !== 0) {
    alert("Please upload images in pairs.");
    return;
  }

  const formData = new FormData();
  selectedFiles.forEach((f) => formData.append("files", f));

  const res = await fetch("/process", { method: "POST", body: formData });
  const data = await res.json();

  sessionId = data.session_id;
  const dl = document.getElementById("download");
  dl.href = `/download/${sessionId}`;
  dl.style.display = "block";
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
