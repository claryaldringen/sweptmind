import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  platform: "darwin",
  openNotificationSettings: () =>
    ipcRenderer.invoke("open-notification-settings"),
  openLocationSettings: () => ipcRenderer.invoke("open-location-settings"),
});
