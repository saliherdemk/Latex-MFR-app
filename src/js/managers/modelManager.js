class ModelManager {
  constructor() {
    this.select = document.getElementById("model-select");
    this.progressContainer = document.getElementById(
      "download-progress-container",
    );
    this.progressBar = document.getElementById("download-progress");
    this.progressLabel = document.getElementById("download-progress-label");
    this.deleteContainer = document.getElementById("delete-model-container");
    this.deleteBtn = document.getElementById("delete-model-btn");
    this._init();
  }

  async _init() {
    const { invoke } = window.__TAURI__.core;
    const { listen } = window.__TAURI__.event;
    const models = await invoke("get_models");

    for (const model of models) {
      const option = document.createElement("option");
      option.value = model.id;
      option.dataset.name = model.name;
      option.dataset.available = model.available;
      option.dataset.downloadable = model.downloadable;
      option.textContent = model.available
        ? model.name
        : `${model.name} (download)`;
      this.select.appendChild(option);
    }

    this._updateDeleteBtn();

    listen("download-progress", (event) => this._onProgress(event.payload));

    this.select.addEventListener("change", () => {
      this._updateDeleteBtn();
      this._onSelect();
    });

    this.deleteBtn.addEventListener("click", () => this._onDelete());
  }

  _updateDeleteBtn() {
    const option = this.select.selectedOptions[0];
    const show =
      option &&
      option.dataset.downloadable === "true" &&
      option.dataset.available === "true";
    this.deleteContainer.classList.toggle("visible", show);
    this._resetDeleteBtn();
  }

  _resetDeleteBtn() {
    this.deleteBtn.textContent = "Delete Model";
    this.deleteBtn.dataset.confirming = "false";
  }

  _onProgress({ downloaded, total }) {
    if (total) {
      const pct = Math.round((downloaded / total) * 100);
      this.progressBar.value = pct;
      this.progressLabel.textContent = `${pct}% (${this._fmt(downloaded)} / ${this._fmt(total)})`;
    } else {
      this.progressBar.removeAttribute("value");
      this.progressLabel.textContent = this._fmt(downloaded);
    }
  }

  _fmt(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async _onDelete() {
    const option = this.select.selectedOptions[0];
    if (!option) return;

    if (this.deleteBtn.dataset.confirming !== "true") {
      this.deleteBtn.textContent = "Confirm Delete";
      this.deleteBtn.dataset.confirming = "true";
      return;
    }

    const { invoke } = window.__TAURI__.core;
    const id = option.value;

    this.deleteBtn.disabled = true;
    this.select.disabled = true;

    try {
      await invoke("delete_model", { id });
      option.textContent = `${option.dataset.name} (download)`;
      option.dataset.available = "false";
      this._updateDeleteBtn();
    } catch (e) {
      console.error("Delete failed:", e);
      this._resetDeleteBtn();
    } finally {
      this.deleteBtn.disabled = false;
      this.select.disabled = false;
    }
  }

  async _onSelect() {
    const option = this.select.selectedOptions[0];
    if (option.dataset.available !== "false") return;

    const { invoke } = window.__TAURI__.core;
    const id = option.value;

    const convertBtn = document.getElementById("convert-btn");

    this.progressBar.value = 0;
    this.progressLabel.textContent = "";
    this.progressContainer.classList.add("active");
    option.textContent = `${option.dataset.name} (downloading...)`;
    option.disabled = true;
    this.select.disabled = true;
    convertBtn.disabled = true;

    try {
      await invoke("download_model", { id });
      option.textContent = option.dataset.name;
      option.dataset.available = "true";
      this.progressContainer.classList.remove("active");
      this._updateDeleteBtn();
    } catch (e) {
      option.textContent = `${option.dataset.name} (download)`;
      this.progressBar.value = 0;
      this.progressLabel.textContent = "";
      this.progressContainer.classList.add("error");
      this.progressContainer.querySelector("#download-error").textContent =
        `Download failed: ${e}`;
      setTimeout(
        () => this.progressContainer.classList.remove("error", "active"),
        4000,
      );
    } finally {
      option.disabled = false;
      this.select.disabled = false;
      convertBtn.disabled = false;
    }
  }

  getSelectedId() {
    return this.select.value;
  }
}
