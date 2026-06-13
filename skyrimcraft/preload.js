// Preload — наразі гра самодостатня, але міст залишено для майбутніх можливостей
// (наприклад, збереження прогресу на диск). Контекст ізольовано задля безпеки.
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('skyrimcraft', {
  version: '1.0.0',
  platform: process.platform,
  isDesktop: true
});
