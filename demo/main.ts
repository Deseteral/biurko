import {WindowManager} from "../src/index.ts";

const desktopElement = document.getElementById("desktop")!;
const desktopButtonsContainerElement = document.createElement('div');
desktopButtonsContainerElement.classList.add('desktop-button-list')
desktopButtonsContainerElement.textContent = 'Desktop'
desktopElement.appendChild(desktopButtonsContainerElement);

const wm = new WindowManager(desktopElement, {
  mode: {type: "infinite-canvas"},
  positionStrategy: {type: "offset-from-focused", offsetX: 20, offsetY: 20},
  windowInteractivity: {type: "focused-only"},
});

wm.addEventListener("window-opened", (e) => console.log("window-opened", e.detail));
wm.addEventListener("window-closed", (e) => console.log("window-closed", e.detail));
wm.addEventListener("window-focused", (e) => console.log("window-focused", e.detail));
wm.addEventListener("window-moved", (e) => console.log("window-moved", e.detail));
wm.addEventListener("window-resized", (e) => console.log("window-resized", e.detail));
wm.addEventListener("viewport-translated", (e) => console.log("viewport-translated", e.detail));

function openTestWindow(title: string, x: number, y: number): void {
  const handle = wm.createWindow({title, x, y, width: 320, height: 240, minWidth: 160, minHeight: 120});

  const surface = wm.getWindowSurface(handle)!;

  const titleBar = document.createElement("div");
  titleBar.classList.add("title-bar");
  titleBar.dataset["biurkoDragRegion"] = "";
  titleBar.textContent = title;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => wm.closeWindow(handle));

  const info = document.createElement("div");
  info.textContent = `Handle: ${handle}`;

  surface.appendChild(titleBar);
  surface.appendChild(info);
  surface.appendChild(closeBtn);
}

const openTestWindowBtn = document.createElement('button');
openTestWindowBtn.textContent = "Open test window"
openTestWindowBtn.addEventListener("click", () => openTestWindow("Test window", 10, 10));
desktopButtonsContainerElement.appendChild(openTestWindowBtn);

const debugResizeBtn = document.createElement('button');
debugResizeBtn.textContent = "Toggle debug resize regions visualization";
debugResizeBtn.addEventListener("click", () => document.body.classList.toggle("debug-resize"));
desktopButtonsContainerElement.appendChild(debugResizeBtn);

const resetTranslateBtn = document.createElement('button');
resetTranslateBtn.textContent = "Reset translate";
resetTranslateBtn.addEventListener("click", () => wm.setViewportTranslate(0, 0));
desktopButtonsContainerElement.appendChild(resetTranslateBtn);

const resetZoomBtn = document.createElement('button');
resetZoomBtn.textContent = "Reset zoom";
resetZoomBtn.addEventListener("click", () => wm.resetZoomLevel());
desktopButtonsContainerElement.appendChild(resetZoomBtn);

const translateLabel = document.createElement('div');
translateLabel.textContent = formatTranslate(wm.getViewportTranslate());
wm.addEventListener("viewport-translated", (e) => {
  translateLabel.textContent = formatTranslate(e.detail);
});
desktopButtonsContainerElement.appendChild(translateLabel);

const reactDemoLink = document.createElement('a');
reactDemoLink.href = "/react.html";
reactDemoLink.textContent = "React demo →";
desktopButtonsContainerElement.appendChild(reactDemoLink);

const solidDemoLink = document.createElement('a');
solidDemoLink.href = "/solid.html";
solidDemoLink.textContent = "Solid.js demo →";
desktopButtonsContainerElement.appendChild(solidDemoLink);

openTestWindow("Window A", 300, 60);
openTestWindow("Window B", 400, 140);
openTestWindow("Window C", 500, 80);

function formatTranslate(t: { x: number; y: number }): string {
  return `translate: (${t.x}, ${t.y})`;
}
