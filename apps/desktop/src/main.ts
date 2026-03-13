import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { exec } from "child_process";
import * as path from "path";
import { BUILD_HASH, BUILD_TIME } from "./build-info";

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL("https://sweptmind.com");

  // Inject titlebar offset for hidden traffic lights + drag region
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow?.webContents.executeJavaScript(`
      (function() {
        const INSET = 38;
        // Offset the main layout so it doesn't sit behind the traffic lights
        const wrapper = document.querySelector('.h-dvh');
        if (wrapper) {
          wrapper.style.height = 'calc(100dvh - ' + INSET + 'px)';
          wrapper.style.marginTop = INSET + 'px';
        }
        // Add a fixed drag region at the top for window dragging
        const drag = document.createElement('div');
        drag.style.cssText =
          'position:fixed;top:0;left:0;right:0;height:' + INSET +
          'px;-webkit-app-region:drag;z-index:9999;';
        document.body.prepend(drag);
      })();
    `);
  });

  // Grant geolocation + notification permissions for nearby detection & push
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "geolocation" || permission === "notifications");
    },
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

app.on("activate", () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  const buildDate = new Date(BUILD_TIME).toLocaleString();
  app.setAboutPanelOptions({
    applicationName: "SweptMind",
    applicationVersion: app.getVersion(),
    version: `Build ${BUILD_HASH} (${buildDate})`,
    copyright: "© 2026 Martin Zadražil. All rights reserved.",
    website: "https://sweptmind.com",
  });

  // IPC: open macOS System Settings panes
  ipcMain.handle("open-notification-settings", () => {
    exec(
      'open "x-apple.systempreferences:com.apple.preference.notifications"',
    );
  });
  ipcMain.handle("open-location-settings", () => {
    exec(
      'open "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"',
    );
  });

  createWindow();

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "CmdOrCtrl+,",
          click: () => {
            mainWindow?.show();
            mainWindow?.webContents.executeJavaScript(
              "window.location.hash = ''; window.location.href = '/settings';",
            );
          },
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "close" }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
