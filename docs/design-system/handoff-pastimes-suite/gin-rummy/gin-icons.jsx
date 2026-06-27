/* Khonsera · Gin Rummy icon subset — Lucide-style, 24 grid, ~1.75 stroke,
 * round caps/joins, no fill, currentColor. Exposed as window.GinIcons. */
(function () {
  const R = window.React, h = R.createElement;
  function Ico(paths, extra) {
    return function (props) {
      const { size = 20, ...rest } = props || {};
      return h("svg", {
        width: size, height: size, viewBox: "0 0 24 24", fill: "none",
        stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round",
        strokeLinejoin: "round", "aria-hidden": "true", ...rest,
      }, paths.map((d, i) => (typeof d === "string"
        ? h("path", { key: i, d })
        : h(d.t, { key: i, ...d.a }))), extra);
    };
  }
  const I = {
    Back: Ico(["M15 18l-6-6 6-6"]),
    Close: Ico(["M18 6 6 18", "M6 6l12 12"]),
    Copy: Ico([{ t: "rect", a: { x: 9, y: 9, width: 11, height: 11, rx: 2 } }, "M5 15V5a2 2 0 0 1 2-2h10"]),
    Check: Ico(["M20 6 9 17l-5-5"]),
    Share: Ico([{ t: "circle", a: { cx: 18, cy: 5, r: 3 } }, { t: "circle", a: { cx: 6, cy: 12, r: 3 } }, { t: "circle", a: { cx: 18, cy: 19, r: 3 } }, "M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"]),
    Users: Ico(["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { t: "circle", a: { cx: 9, cy: 7, r: 4 } }, "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"]),
    UserPlus: Ico(["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", { t: "circle", a: { cx: 9, cy: 7, r: 4 } }, "M19 8v6M22 11h-6"]),
    Spade: Ico(["M12 3c-1 4-7 6-7 11a3.5 3.5 0 0 0 6 2c-.3 2-1 3.5-2 4.5h6c-1-1-1.7-2.5-2-4.5a3.5 3.5 0 0 0 6-2c0-5-6-7-7-11Z"]),
    Sliders: Ico(["M4 6h10", "M18 6h2", "M8 12h12", "M4 12h0.01", "M4 18h7", "M15 18h5", { t: "circle", a: { cx: 16, cy: 6, r: 2 } }, { t: "circle", a: { cx: 6, cy: 12, r: 2 } }, { t: "circle", a: { cx: 13, cy: 18, r: 2 } }]),
    Wifi: Ico(["M5 12.5a10 10 0 0 1 14 0", "M8.5 16a5 5 0 0 1 7 0", { t: "circle", a: { cx: 12, cy: 19.5, r: 0.6, fill: "currentColor" } }]),
    WifiOff: Ico(["M2 2l20 20", "M8.5 16a5 5 0 0 1 6.3-.6", "M5 12.5a10 10 0 0 1 3.5-2.3", "M19 12.5a10 10 0 0 0-7.3-2.9", { t: "circle", a: { cx: 12, cy: 19.5, r: 0.6, fill: "currentColor" } }]),
    Refresh: Ico(["M21 12a9 9 0 1 1-3-6.7L21 8", "M21 3v5h-5"]),
    LogOut: Ico(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"]),
    Flag: Ico(["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1Z", "M4 22v-7"]),
    Bell: Ico(["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]),
    Compass: Ico([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, "M16.2 7.8l-2.9 6.4-6.4 2.9 2.9-6.4 6.4-2.9z"]),
    Clock: Ico([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, "M12 7v5l3 2"]),
    Dot: Ico([{ t: "circle", a: { cx: 12, cy: 12, r: 3, fill: "currentColor", stroke: "none" } }]),
    Hourglass: Ico(["M6 3h12", "M6 21h12", "M8 3c0 5 8 5 8 9s-8 4-8 9", "M16 3c0 5-8 5-8 9s8 4 8 9"]),
    Help: Ico([{ t: "circle", a: { cx: 12, cy: 12, r: 9 } }, "M9.3 9.3a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 2.4", { t: "circle", a: { cx: 12, cy: 17, r: 0.7, fill: "currentColor", stroke: "none" } }]),
    Sort: Ico(["M7 4v15", "M4 16l3 3 3-3", "M17 20V5", "M14 8l3-3 3 3"]),
  };
  window.GinIcons = I;
})();
