const manager = new Manager();

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    manager.undo();
  }
  if (e.ctrlKey && e.key === "v") {
    e.preventDefault();
    setState("loading");
    invoke("read_clipboard_image")
      .then((base64) => displayImage(`data:image/png;base64,${base64}`))
      .catch(() => setState("empty"));
  }
});

document.getElementById("switch-canvas").addEventListener("click", (e) => {
  manager.showCanvas();
});

document.getElementById("switch-img").addEventListener("click", (e) => {
  manager.showImage();
});

const imgContainer = document.getElementById("img-container");
const preview = document.getElementById("preview");
const dropHint = imgContainer.querySelector("p");
const spinner = document.getElementById("spinner");
const fileInput = document.getElementById("import-file-input");

const { listen } = window.__TAURI__.event;
const { convertFileSrc, invoke } = window.__TAURI__.core;

const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

function setState(state) {
  dropHint.style.display = state === "empty" ? "block" : "none";
  spinner.style.display = state === "loading" ? "block" : "none";
  preview.style.display = state === "image" ? "block" : "none";
}

function displayImage(src) {
  setState("loading");
  preview.innerHTML = "";
  const img = document.createElement("img");
  img.draggable = false;
  img.onload = () => setState("image");
  img.onerror = () => setState("empty");
  img.src = src;
  preview.appendChild(img);
}

function addImage(path) {
  const lower = path.toLowerCase();
  if (!imageExtensions.some((ext) => lower.endsWith(ext))) return;
  displayImage(convertFileSrc(path));
}

setState("empty");

imgContainer.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => displayImage(e.target.result);
  reader.readAsDataURL(file);
  fileInput.value = "";
});

listen("tauri://drag", () => {
  imgContainer.classList.add("dragover");
});

listen("tauri://drag-leave", () => {
  imgContainer.classList.remove("dragover");
});

listen("tauri://drag-drop", (event) => {
  imgContainer.classList.remove("dragover");
  event.payload.paths.forEach(addImage);
});
