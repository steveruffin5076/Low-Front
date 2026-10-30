// Gives the game `window.lowFront.quit()`; src/platform/quit.ts uses it for Quit Game.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lowFront', {
  quit: () => ipcRenderer.send('lowfront:quit'),
});
