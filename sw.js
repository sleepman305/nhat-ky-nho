/*
  NHẬT KÝ NHỎ — bộ nhớ đệm ngoại tuyến
  by SirV

  Giữ lại toàn bộ ứng dụng trong máy sau lần mở đầu tiên, để những lần sau
  không cần mạng vẫn đọc được nhật ký.

  Chiến lược: đã có trong đệm thì trả ra ngay, chưa có thì tải về rồi cất lại.
  Hợp với app này vì nội dung app gần như không đổi, còn nhật ký thì nằm trong
  IndexedDB chứ không đi qua đây.
*/

const TEN_DEM = "nhat-ky-nho-v18";

/** Những thứ phải có sẵn ngay từ lúc cài, không chờ người dùng mở tới. */
const CAN_TRUOC = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", (sk) => {
  sk.waitUntil(
    caches.open(TEN_DEM)
      // Dùng addAll từng cái một: chỉ cần một file lỗi là cả mẻ hỏng,
      // mà thiếu một biểu tượng thì không đáng để app không cài được.
      .then((dem) => Promise.all(CAN_TRUOC.map((u) => dem.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (sk) => {
  sk.waitUntil(
    caches.keys()
      .then((ds) => Promise.all(ds.filter((t) => t !== TEN_DEM).map((t) => caches.delete(t))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (sk) => {
  const yc = sk.request;
  if (yc.method !== "GET") return;

  sk.respondWith(
    caches.match(yc).then((san) => {
      if (san) return san;

      return fetch(yc).then((tl) => {
        // Phông chữ Google trả về kiểu "opaque" nên không đọc được nội dung,
        // nhưng vẫn cất được và vẫn hiển thị đúng khi offline.
        if (tl && (tl.ok || tl.type === "opaque")) {
          const ban = tl.clone();
          caches.open(TEN_DEM).then((dem) => dem.put(yc, ban)).catch(() => {});
        }
        return tl;
      }).catch(() => {
        // Mất mạng giữa chừng: nếu là yêu cầu mở trang thì trả bản đã cất.
        if (yc.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "Không có mạng" });
      });
    })
  );
});
