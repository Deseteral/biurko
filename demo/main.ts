import { type WindowHandle, WindowManager } from "../src/index.ts";

const desktopElement = document.getElementById("desktop")!;
const desktopButtonsContainerElement = document.createElement("div");
desktopButtonsContainerElement.classList.add("desktop-button-list");
desktopButtonsContainerElement.textContent = "Desktop";
desktopElement.appendChild(desktopButtonsContainerElement);

const wm = new WindowManager(desktopElement, {
  mode: { type: "infinite-canvas" },
  positionStrategy: { type: "offset-from-focused", offsetX: 20, offsetY: 20 },
  windowInteractivity: { type: "focused-only" },
});

wm.addEventListener("window-opened", (e) => console.log("window-opened", e.detail));
wm.addEventListener("window-closed", (e) => console.log("window-closed", e.detail));
wm.addEventListener("window-focused", (e) => console.log("window-focused", e.detail));
wm.addEventListener("window-moved", (e) => console.log("window-moved", e.detail));
wm.addEventListener("window-resized", (e) => console.log("window-resized", e.detail));
wm.addEventListener("viewport-translated", (e) => console.log("viewport-translated", e.detail));

function openTestWindow(title: string, x: number, y: number): WindowHandle {
  const handle = wm.createWindow({ title, x, y, width: 320, height: 240, minWidth: 160, minHeight: 120 });

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

  return handle;
}

const openTestWindowBtn = document.createElement("button");
openTestWindowBtn.textContent = "Open test window";
openTestWindowBtn.addEventListener("click", () => openTestWindow("Test window", 10, 10));
desktopButtonsContainerElement.appendChild(openTestWindowBtn);

const openAutoSizeWindowBtn = document.createElement("button");
openAutoSizeWindowBtn.textContent = "Open content-sized window";
openAutoSizeWindowBtn.addEventListener("click", () => {
  const handle = wm.createWindow({ title: "Content-sized", x: 320, y: 360 });
  const surface = wm.getWindowSurface(handle)!;
  const titleBar = document.createElement("div");
  titleBar.classList.add("title-bar");
  titleBar.dataset["biurkoDragRegion"] = "";
  titleBar.textContent = "Content-sized · drag me";

  const content = document.createElement("div");
  content.style.whiteSpace = "pre";
  content.textContent = "Short menu";

  const toggle = document.createElement("button");
  toggle.textContent = "Toggle content";
  let expanded = false;
  toggle.addEventListener("click", () => {
    expanded = !expanded;
    content.textContent = expanded ? "A longer menu item grows the window\nSecond item\nThird item" : "Short menu";
  });

  surface.append(titleBar, content, toggle);
});
desktopButtonsContainerElement.appendChild(openAutoSizeWindowBtn);

const openTreeBtn = document.createElement("button");
openTreeBtn.textContent = "Open parent-child tree";
openTreeBtn.addEventListener("click", () => {
  const parent = openTestWindow("Tree parent", 640, 60);
  const child = openTestWindow("Tree child", 760, 180);
  const grandchild = openTestWindow("Tree grandchild", 880, 300);
  wm.attachWindowToParent(child, parent);
  wm.attachWindowToParent(grandchild, child);
});
desktopButtonsContainerElement.appendChild(openTreeBtn);

const openDetachingTreeBtn = document.createElement("button");
openDetachingTreeBtn.textContent = "Open parent-child tree (detach on drag)";
openDetachingTreeBtn.addEventListener("click", () => {
  const parent = openTestWindow("Detaching tree parent", 640, 60);
  const child = openTestWindow("Detaching tree child", 760, 180);
  const grandchild = openTestWindow("Detaching tree grandchild", 880, 300);
  wm.attachWindowToParent(child, parent, { detachOnDrag: true });
  wm.attachWindowToParent(grandchild, child);
});
desktopButtonsContainerElement.appendChild(openDetachingTreeBtn);

const debugResizeBtn = document.createElement("button");
debugResizeBtn.textContent = "Toggle debug resize regions visualization";
debugResizeBtn.addEventListener("click", () => document.body.classList.toggle("debug-resize"));
desktopButtonsContainerElement.appendChild(debugResizeBtn);

const resetTranslateBtn = document.createElement("button");
resetTranslateBtn.textContent = "Reset translate";
resetTranslateBtn.addEventListener("click", () => wm.setViewportTranslate(0, 0));
desktopButtonsContainerElement.appendChild(resetTranslateBtn);

const resetZoomBtn = document.createElement("button");
resetZoomBtn.textContent = "Reset zoom";
resetZoomBtn.addEventListener("click", () => wm.resetZoomLevel());
desktopButtonsContainerElement.appendChild(resetZoomBtn);

const translateLabel = document.createElement("div");
translateLabel.textContent = formatTranslate(wm.getViewportTranslate());
wm.addEventListener("viewport-translated", (e) => {
  translateLabel.textContent = formatTranslate(e.detail);
});
desktopButtonsContainerElement.appendChild(translateLabel);

const reactDemoLink = document.createElement("a");
reactDemoLink.href = "/react.html";
reactDemoLink.textContent = "React demo →";
desktopButtonsContainerElement.appendChild(reactDemoLink);

const solidDemoLink = document.createElement("a");
solidDemoLink.href = "/solid.html";
solidDemoLink.textContent = "Solid.js demo →";
desktopButtonsContainerElement.appendChild(solidDemoLink);

openTestWindow("Window A", 300, 60);
openTestWindow("Window B", 400, 140);
openTestWindow("Window C", 500, 80);

function formatTranslate(t: { x: number; y: number }): string {
  return `translate: (${t.x}, ${t.y})`;
}
