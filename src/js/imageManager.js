class ImageManager {
  constructor() {
    this.imgContainer = document.getElementById("img-container");
    this.preview = document.getElementById("preview");
    this.dropHint = this.imgContainer.querySelector("p");
    this.spinner = document.getElementById("spinner");
    this.fileInput = document.getElementById("import-file-input");

    this.imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

    this.setState("empty");
    this._bindEvents();
  }

  setState(state) {
    this.dropHint.style.display = state === "empty" ? "block" : "none";
    this.spinner.style.display = state === "loading" ? "block" : "none";
    this.preview.style.display = state === "image" ? "block" : "none";
  }

  displayImage(src) {
    this.setState("loading");
    this.preview.innerHTML = "";
    const img = document.createElement("img");
    img.draggable = false;
    img.onload = () => this.setState("image");
    img.onerror = () => this.setState("empty");
    img.src = src;
    this.preview.appendChild(img);
  }

  addImage(path) {
    const lower = path.toLowerCase();
    if (!this.imageExtensions.some((ext) => lower.endsWith(ext))) return;
    const { convertFileSrc } = window.__TAURI__.core;
    this.displayImage(convertFileSrc(path));
  }

  _bindEvents() {
    const { listen } = window.__TAURI__.event;

    this.imgContainer.addEventListener("click", () => this.fileInput.click());

    this.fileInput.addEventListener("change", () => {
      const file = this.fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => this.displayImage(e.target.result);
      reader.readAsDataURL(file);
      this.fileInput.value = "";
    });

    listen("tauri://drag", () => {
      this.imgContainer.classList.add("dragover");
    });

    listen("tauri://drag-leave", () => {
      this.imgContainer.classList.remove("dragover");
    });

    listen("tauri://drag-drop", (event) => {
      this.imgContainer.classList.remove("dragover");
      event.payload.paths.forEach((path) => this.addImage(path));
    });
  }
}
