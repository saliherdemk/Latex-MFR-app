const manager = new Manager();

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "z") {
    e.preventDefault();
    manager.undo();
  }
});

document.getElementById("import-file-input").addEventListener("change", (e) => {
  console.log(e);
});
