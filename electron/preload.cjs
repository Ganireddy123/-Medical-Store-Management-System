const { contextBridge, ipcRenderer } = require("electron");

async function invokeDatabase(channel, ...args) {
  const response = await ipcRenderer.invoke(channel, ...args);
  if (!response?.ok) {
    const error = new Error(response?.error?.message || "Local database operation failed.");
    error.code = response?.error?.code || "DATABASE";
    throw error;
  }
  return response;
}

contextBridge.exposeInMainWorld("medicalStore", {
  getDatabaseStatus: () => ipcRenderer.invoke("database:status"),
  request: async (request) => {
    const response = await invokeDatabase("api:request", request);
    return response.data;
  },
  backupDatabase: () => invokeDatabase("database:backup"),
  restoreDatabase: () => invokeDatabase("database:restore"),
});