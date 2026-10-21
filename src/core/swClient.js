import { state } from "../state";

export async function registerSW(swUrl = './sw.js') {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(swUrl);
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

export async function clearCacheAndReload() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && reg.active) {
      await new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => resolve();
        reg.active.postMessage({ type: 'CLEAR_CACHE' }, [channel.port2]);
        setTimeout(resolve, 2000);
      });
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    if (reg) await reg.unregister();
  } catch (err) {
    console.error('Failed to clear cache:', err);
  } finally {
    window.location.reload();
  }
}

window.appCache = { register: registerSW, clearCacheAndReload };

window.addEventListener('load', () => registerSW());
