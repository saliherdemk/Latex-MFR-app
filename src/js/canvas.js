function setup() {
  const { w, h } = manager.getCanvasDimensions();
  const cnv = createCanvas(w, h);
  cnv.parent("canvas-container");
  manager.canvas = cnv;
  background(255);

  canvas = document.querySelector("canvas");
  canvas.addEventListener("wheel", function (e) {
    mouseWheelCanvas(e);
    e.preventDefault();
  });
}

function draw() {
  background(255);

  if (mouseIsPressed && mouseButton === LEFT) {
    manager.setCurrentStroke(mouseX, mouseY, pmouseX, pmouseY);
  } else {
    manager.addStroke();
  }

  push();
  translate(...manager.getPan());
  scale(manager.getZoom());
  manager.draw();
  pop();
}

function mouseDragged() {
  if (mouseButton === CENTER) {
    const [px, py] = manager.getPan();
    manager.setPan(px + mouseX - pmouseX, py + mouseY - pmouseY);
  }
}

function mouseWheelCanvas(event) {
  const factor = event.deltaY > 0 ? 0.9 : 1.1;
  const [px, py] = manager.getPan();

  const mx = event.offsetX;
  const my = event.offsetY;

  manager.setPan(mx - (mx - px) * factor, my - (my - py) * factor);
  manager.setZoom(factor);
}

function windowResized() {
  const { w, h } = manager.getCanvasDimensions();
  resizeCanvas(w, h);
}
