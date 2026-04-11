const canvasManager = new CanvasManager();
const imageManager = new ImageManager();
const modelManager = new ModelManager();
const manager = new Manager();

const { invoke } = window.__TAURI__.core;

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    canvasManager.undo();
  }
  if (e.ctrlKey && e.key === "v") {
    e.preventDefault();
    imageManager.setState("loading");
    invoke("read_clipboard_image")
      .then((base64) =>
        imageManager.displayImage(`data:image/png;base64,${base64}`),
      )
      .catch(() => imageManager.setState("empty"));
  }
});

document.getElementById("switch-canvas").addEventListener("click", () => {
  manager.showCanvas();
});

document.getElementById("switch-img").addEventListener("click", () => {
  manager.showImage();
});

document.getElementById("convert-btn").addEventListener("click", async () => {
  manager.convert();
});
