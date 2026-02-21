self.addEventListener("install", (event) => {
    console.log("Service Worker installing...");
    self.skipWaiting();
  });
  
  self.addEventListener("activate", (event) => {
    console.log("Service Worker activated");
  });
  
  self.addEventListener("fetch", () => {
    // 아무 캐싱도 안 함
  });
  