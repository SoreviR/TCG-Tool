document.addEventListener("DOMContentLoaded", () => {
  let files = [];
  let sessionId = null;

  const dict = {
    es: {
      title: "Procesador de Cartas TCG",
      desc: "Sube imágenes en pares (front/back). Se recortará un marco de 5mm.",
      drop: "Arrastra imágenes o haz click aquí",
      process: "Procesar",
      download: "Descargar",
    },
    en: {
      title: "TCG Image Processor",
      desc: "Upload images in pairs (front/back). A 5mm border will be cropped.",
      drop: "Drag & drop images or click here",
      process: "Process",
      download: "Download",
    },
  };

  let lang = localStorage.getItem("lang") || "es";
  let theme = localStorage.getItem("theme") || "dark";

  const navbar = document.getElementById("navbar");
  const langBtn = document.getElementById("langBtn");
  const themeBtn = document.getElementById("themeBtn");

  function applyLang() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = dict[lang][el.dataset.i18n];
    });
    langBtn.textContent = lang.toUpperCase();
  }

  function applyTheme() {
    document.body.classList.toggle("light", theme === "light");
    themeBtn.textContent = theme === "light" ? "🌙" : "☀️";
  }

  applyLang();
  applyTheme();

  const menuToggle = document.getElementById("menuToggle");
  menuToggle.onclick = () => {
    navbar.classList.toggle("open");
    menuToggle.classList.toggle("open");
  };

  langBtn.onclick = () => {
    lang = lang === "es" ? "en" : "es";
    localStorage.setItem("lang", lang);
    applyLang();
  };

  themeBtn.onclick = () => {
    theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("theme", theme);
    applyTheme();
  };

  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("files");
  const preview = document.getElementById("preview");
  const progressBar = document.getElementById("progressBar");
  const download = document.getElementById("download");

  dropzone.onclick = () => input.click();

  dropzone.ondragover = (e) => e.preventDefault();

  dropzone.ondrop = (e) => {
    e.preventDefault();
    files.push(...e.dataTransfer.files);
    renderPreview();
  };

  input.onchange = () => {
    files.push(...input.files);
    renderPreview();
  };

  function renderPreview() {
    preview.innerHTML = "";
    files.forEach((f) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(f);
      preview.appendChild(img);
    });
  }

  document.getElementById("processBtn").onclick = async () => {
    if (files.length === 0) return;

    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    const res = await fetch("/process", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    sessionId = data.session_id;

    pollProgress();
  };

  async function pollProgress() {
    const res = await fetch(`/progress/${sessionId}`);
    const data = await res.json();

    progressBar.style.width = data.progress + "%";

    if (!data.done) {
      setTimeout(pollProgress, 500);
    } else {
      download.href = `/download/${sessionId}`;
      download.style.display = "block";
    }
  }
});
