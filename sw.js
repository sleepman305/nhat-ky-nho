/*
  NHẬT KÝ NHỎ — bộ nhớ đệm ngoại tuyến
  by SirV

  Giữ lại toàn bộ ứng dụng trong máy sau lần mở đầu tiên, để những lần sau
  không cần mạng vẫn đọc được nhật ký.

  Chia làm hai lối:

    Trang chính  — HỎI MẠNG TRƯỚC. Có mạng thì luôn lấy bản mới nhất, mất
                   mạng mới lấy bản trong đệm. Trước đây trang chính cũng
                   theo lối "có đệm là trả ra ngay", nên bản mới đẩy lên
                   bao nhiêu lần máy cũng không thấy.
    Còn lại      — có trong đệm thì trả ra ngay. Phông chữ, biểu tượng gần
                   như không đổi, hỏi mạng mỗi lần chỉ tổ chậm.

  Nhật ký nằm trong IndexedDB, không đi qua đây.
*/

const TEN_DEM = "nhat-ky-nho-v33";

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

  // Trang chính: hỏi mạng trước, để anh luôn có bản mới nhất.
  const laTrang = yc.mode === "navigate" ||
    yc.destination === "document" ||
    /\/(index\.html)?(\?.*)?$/.test(new URL(yc.url).pathname + new URL(yc.url).search);

  if (laTrang) {
    sk.respondWith(
      fetch(yc).then((tl) => {
        if (tl && tl.ok) {
          const ban = tl.clone();
          caches.open(TEN_DEM).then((dem) => dem.put(yc, ban)).catch(() => {});
        }
        return tl;
      }).catch(() =>
        caches.match(yc).then((san) => san || caches.match("./index.html"))
      )
    );
    return;
  }

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
