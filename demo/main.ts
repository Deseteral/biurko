import {WindowManager} from "../src/index.ts";

const desktopElement = document.getElementById("desktop")!;
const desktopButtonsContainerElement = document.createElement('div');
desktopButtonsContainerElement.classList.add('desktop-button-list')
desktopButtonsContainerElement.textContent = 'Desktop'
desktopElement.appendChild(desktopButtonsContainerElement);

const wm = new WindowManager(desktopElement);

wm.addEventListener("window-closed", (e) => console.log("window-closed", e.detail));
wm.addEventListener("window-focused", (e) => console.log("window-focused", e.detail));
wm.addEventListener("window-moved", (e) => console.log("window-moved", e.detail));
wm.addEventListener("window-resized", (e) => console.log("window-resized", e.detail));

function openTestWindow(title: string, x: number, y: number): void {
  const handle = wm.createWindow({title, x, y, width: 320, height: 240, minWidth: 160, minHeight: 120});

  const surface = wm.getWindowSurface(handle)!;

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => wm.closeWindow(handle));

  const info = document.createElement("div");
  info.textContent = `Handle: ${handle}`;

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

openTestWindow("Window A", 60, 60);
openTestWindow("Window B", 200, 140);
openTestWindow("Window C", 400, 80);
