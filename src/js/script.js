const { invoke } = window.__TAURI__.core;
const getElementById = (id) => document.getElementById(id);

const switchCanvas = getElementById("switch-canvas");
const switchImg = getElementById("switch-img");
const convertBtn = getElementById("convert-btn");

const canvasManager = new CanvasManager();
const imageManager = new ImageManager();
const modelManager = new ModelManager();
const manager = new Manager();

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    canvasManager.undo();
  }
  if (e.ctrlKey && e.key === "v" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    imageManager.setState("loading");
    invoke("read_clipboard_image")
      .then((base64) =>
        imageManager.displayImage(`data:image/png;base64,${base64}`),
      )
      .catch(() => imageManager.setState("empty"));
  }
});

switchCanvas.addEventListener("click", () => {
  manager.showCanvas();
});

switchImg.addEventListener("click", () => {
  manager.showImage();
});

convertBtn.addEventListener("click", async () => {
  manager.convert();
});
