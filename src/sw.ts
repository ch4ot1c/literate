import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Take control of the page immediately
clientsClaim();

// Clean up old assets
cleanupOutdatedCaches();

// This is where Vite injects your asset manifest
precacheAndRoute(self.__WB_MANIFEST || []);

// Handle the skipWaiting signal from the registerSW call
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});