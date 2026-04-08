const { invoke } = window.__TAURI__.core;

let strokes = [];
let currentStroke = null;
let images = [];

let panX = 0;
let panY = 0;
let zoom = 1;

function canvasDimensions() {
  const container = document.getElementById("canvas-container");
  const w = container.offsetWidth;
  const h = Math.max(windowHeight * 0.3, 500);
  return { w, h };
}

function worldCoords() {
  return {
    x: (mouseX - panX) / zoom,
    y: (mouseY - panY) / zoom,
    px: (pmouseX - panX) / zoom,
    py: (pmouseY - panY) / zoom,
  };
}

function setup() {
  const { w, h } = canvasDimensions();
  const cnv = createCanvas(w, h);
  cnv.parent("canvas-container");
  background(255);

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "z") {
      e.preventDefault();
      strokes.pop();
    }
  });

  document.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && e.key === "v") {
      try {
        const b64 = await invoke("read_clipboard_image");
        loadImage("data:image/png;base64," + b64, (img) => {
          images.push({
            img,
            x: (width / 2 - panX) / zoom - img.width / 2,
            y: (height / 2 - panY) / zoom - img.height / 2,
          });
        });
      } catch (err) {
        console.error(err);
      }
    }
  });
}

function draw() {
  background(255);

  if (mouseIsPressed && mouseButton === LEFT) {
    if (!currentStroke) currentStroke = [];
    const { x, y, px, py } = worldCoords();
    currentStroke.push(new DrawnLine(x, y, px, py));
  } else if (currentStroke) {
    strokes.push(currentStroke);
    currentStroke = null;
  }

  push();
  translate(panX, panY);
  scale(zoom);

  for (const { img, x, y } of images) {
    image(img, x, y);
  }

  for (const stroke of strokes) {
    for (const segment of stroke) segment.show();
  }
  if (currentStroke) {
    for (const segment of currentStroke) segment.show();
  }

  pop();
}

function mouseDragged() {
  if (mouseButton === CENTER) {
    panX += mouseX - pmouseX;
    panY += mouseY - pmouseY;
  }
}

function mouseWheel(event) {
  const factor = event.delta > 0 ? 0.9 : 1.1;
  panX = mouseX - (mouseX - panX) * factor;
  panY = mouseY - (mouseY - panY) * factor;
  zoom *= factor;
  return false;
}

function windowResized() {
  const { w, h } = canvasDimensions();
  resizeCanvas(w, h);
}
