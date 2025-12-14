/*************************************************
 * CONFIG
 *************************************************/
const MAX_IMAGES = 20;

/*************************************************
 * STATE
 *************************************************/
let selectedFiles = [];
let sessionId = null;

let lang = localStorage.getItem("lang") || "es";
let theme = localStorage.getItem("theme") || "dark";

/*************************************************
 * I18N
 *************************************************/
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
    errorPairs: "Debes subir un número par de imágenes",
    errorLimit: "Has superado el límite de imágenes",
    uploading: "Subiendo imágenes...",
    processing: "Procesando cartas...",
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
    errorPairs: "You must upload an even number of images",
    errorLimit: "Image limit exceeded",
    uploading: "Uploading images...",
    processing: "Processing cards...",
  },
};

function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.innerText = dict[lang][el.dataset.i18n];
  });
}

function applyTheme() {
  document.body.classList.toggle("light", theme === "light");
}

/*************************************************
 * UI ELEMENTS
 *************************************************/
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("files");
const preview = document.getElementById("preview");
const startBtn = document.getElementById("startBtn");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const downloadLink = document.getElementById("download");
const log = document.getElementById("log");

/*************************************************
 * NAV / TOGGLES
 *************************************************/
document.getElementById("menuToggle").onclick = () => {
  document.getElementById("binder").classList.toggle("collapsed");
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

/*************************************************
 * FILE HANDLING
 *************************************************/
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
    if (selectedFiles.length >= MAX_IMAGES) {
      alert(dict[lang].errorLimit);
      break;
    }
    selectedFiles.push(file);
  }
  updatePreview();
}

/*************************************************
 * DRAG & DROP
 *************************************************/
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("hover");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("hover");
});

dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("hover");
  addFiles(e.dataTransfer.files);
});

fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

/*************************************************
 * UPLOAD & PROCESS
 *************************************************/
startBtn.addEventListener("click", async () => {
  if (selectedFiles.length === 0) return;

  if (selectedFiles.length % 2 !== 0) {
    alert(dict[lang].errorPairs);
    return;
  }

  progressFill.style.width = "0%";
  progressText.innerText = "0%";
  downloadLink.style.display = "none";
  log.innerText = dict[lang].uploading;

  const formData = new FormData();
  selectedFiles.forEach((f) => formData.append("files", f));

  const res = await fetch("/upload", {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  sessionId = data.session_id;

  log.innerText = dict[lang].processing;
  pollProgress();
});

/*************************************************
 * PROGRESS POLLING
 *************************************************/
async function pollProgress() {
  const res = await fetch(`/progress/${sessionId}`);
  const data = await res.json();

  if (data.total > 0) {
    const percent = Math.round((data.current / data.total) * 100);
    progressFill.style.width = percent + "%";
    progressText.innerText = percent + "%";
  }

  if (data.running) {
    setTimeout(pollProgress, 500);
  } else {
    progressFill.style.width = "100%";
    progressText.innerText = "100%";
    downloadLink.href = `/download/${sessionId}`;
    downloadLink.style.display = "block";
    log.innerText = "";
  }
}

/*************************************************
 * INIT
 *************************************************/
applyLang();
applyTheme();
