document.addEventListener("DOMContentLoaded", () => {
  let files = [];
  let sessionId = null;
  let polling = false;

  /* ================= NAVBAR ================= */
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

  let lang = localStorage.getItem("lang") || "en";
  let theme = localStorage.getItem("theme") || "dark";

  const navbar = document.getElementById("navbar");
  const menuToggle = document.getElementById("menuToggle");
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
  menuToggle.addEventListener("click", () => {
    const open = navbar.classList.toggle("open");
    menuToggle.classList.toggle("open", open);
    menuToggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

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

  /* ================= FILE UPLOAD ================= */

  const dropzone = document.getElementById("dropzone");
  const input = document.getElementById("files");
  const preview = document.getElementById("preview");

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

  /* ================= PROCESS ================= */

  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const download = document.getElementById("download");
  const processBtn = document.getElementById("processBtn");

  processBtn.onclick = async () => {
    if (!files.length || polling) return;

    processBtn.disabled = true;
    processBtn.textContent = "Processing...";
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    download.style.display = "none";

    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));

    const res = await fetch("/process", {
      method: "POST",
      body: fd,
    });

    const data = await res.json();
    sessionId = data.session_id;
    polling = true;
    pollProgress();
  };

  async function pollProgress() {
    if (!sessionId) return;

    try {
      const res = await fetch(`/progress/${sessionId}`);
      const data = await res.json();

      progressBar.style.width = data.progress + "%";
      progressText.textContent = data.progress + "%";

      if (!data.done) {
        setTimeout(pollProgress, 500);
      } else {
        polling = false;
        processBtn.disabled = false;
        processBtn.textContent = "Process";
        download.href = `/download/${sessionId}`;
        download.style.display = "block";
      }
    } catch {
      setTimeout(pollProgress, 1000);
    }
  }

  /* ================= RESET ================= */

  document.getElementById("resetBtn").onclick = () => {
    files = [];
    sessionId = null;
    polling = false;
    preview.innerHTML = "";
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    download.style.display = "none";
    processBtn.disabled = false;
    processBtn.textContent = "Process";
    input.value = "";
  };

  /* ================= FEEDBACK ================= */

  const fbBtn = document.getElementById("feedbackBtn");
  const fbModal = document.getElementById("feedbackModal");
  const closeFb = document.getElementById("closeFeedback");
  const sendFb = document.getElementById("sendFeedback");
  const fbStatus = document.getElementById("fbStatus");

  fbBtn.onclick = () => {
    fbModal.style.display = "flex";
    fbStatus.textContent = "";
  };

  closeFb.onclick = () => {
    fbModal.style.display = "none";
  };

  sendFb.onclick = async () => {
    const message = document.getElementById("fbMessage").value.trim();
    const email = document.getElementById("fbEmail").value.trim();
    const category = document.getElementById("fbCategory").value;

    if (!category || !message) {
      fbStatus.textContent = "Please complete category and message.";
      fbStatus.className = "feedback-status error";
      return;
    }

    fbStatus.textContent = "Sending...";
    fbStatus.className = "feedback-status loading";

    await fetch("/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message, email }),
    });

    fbStatus.textContent = "Thank you!";
    fbStatus.className = "feedback-status success";

    setTimeout(() => (fbModal.style.display = "none"), 1200);
  };
});
