import {WindowManager} from "../src/index.ts";

const desktopElement = document.getElementById("desktop")!;

const wm = new WindowManager(desktopElement);

wm.addEventListener("window-close", (e) => console.log("window-close", e.detail));
wm.addEventListener("window-focus", (e) => console.log("window-focus", e.detail));
wm.addEventListener("window-move", (e) => console.log("window-move", e.detail));
wm.addEventListener("window-resize", (e) => console.log("window-resize", e.detail));

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
desktopElement.appendChild(openTestWindowBtn);

openTestWindow("Window A", 60, 60);
openTestWindow("Window B", 200, 140);
openTestWindow("Window C", 400, 80);
