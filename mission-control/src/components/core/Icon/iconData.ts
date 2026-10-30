/** SVG child elements of the exported Órbita icon set (docs/design/prototype/icons), one entry per file stem. */
export type IconNode = readonly [
  tag: "path" | "circle" | "rect" | "ellipse",
  attrs: Readonly<Record<string, string>>,
];

export const ICON_NODES = {
  activity: [["path", { d: "M3 12h4l3-8 4 16 3-8h4" }]],
  alert: [
    ["path", { d: "M12 3 2 20h20z" }],
    ["path", { d: "M12 10v4M12 17h.01" }],
  ],
  archive: [
    ["rect", { x: "3", y: "4", width: "18", height: "5", rx: "1" }],
    ["path", { d: "M5 9v10h14V9M10 13h4" }],
  ],
  arrow: [["path", { d: "M5 12h14M13 6l6 6-6 6" }]],
  back: [["path", { d: "M19 12H5M11 6l-6 6 6 6" }]],
  bolt: [["path", { d: "m13 2-8 12h7l-1 8 8-12h-7z" }]],
  book: [
    ["path", { d: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" }],
    ["path", { d: "M4 21V5M8 7h7" }],
  ],
  branch: [
    ["circle", { cx: "6", cy: "5", r: "2" }],
    ["circle", { cx: "6", cy: "19", r: "2" }],
    ["circle", { cx: "18", cy: "8", r: "2" }],
    ["path", { d: "M6 7v10M18 10c0 4-6 3-11 7" }],
  ],
  bulb: [
    ["path", { d: "M9 18h6M10 21h4" }],
    ["path", { d: "M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" }],
  ],
  chart: [["path", { d: "M4 20V10M10 20V4M16 20v-7M22 20H2" }]],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  chevD: [["path", { d: "m6 9 6 6 6-6" }]],
  chevR: [["path", { d: "m9 6 6 6-6 6" }]],
  circle: [["circle", { cx: "12", cy: "12", r: "8" }]],
  clipboard: [
    ["rect", { x: "5", y: "4", width: "14", height: "17", rx: "2" }],
    ["path", { d: "M9 4V3h6v1M9 12l2 2 4-4" }],
  ],
  clock: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["path", { d: "M12 7v5l3 2" }],
  ],
  columns: [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }],
    ["path", { d: "M9 4v16M15 4v16" }],
  ],
  copy: [
    ["rect", { x: "8", y: "8", width: "12", height: "12", rx: "2" }],
    ["path", { d: "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" }],
  ],
  crown: [["path", { d: "M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" }]],
  cube: [
    ["path", { d: "M21 8 12 3 3 8v8l9 5 9-5z" }],
    ["path", { d: "m3 8 9 5 9-5M12 13v8" }],
  ],
  database: [
    ["ellipse", { cx: "12", cy: "5", rx: "8", ry: "3" }],
    ["path", { d: "M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" }],
  ],
  diamond: [
    ["path", { d: "M6 4h12l3 5-9 11L3 9z" }],
    ["path", { d: "M3 9h18M9 4l3 16M15 4l-3 16" }],
  ],
  dot: [["circle", { cx: "12", cy: "12", r: "3" }]],
  external: [
    ["path", { d: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" }],
  ],
  eye: [
    ["path", { d: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" }],
    ["circle", { cx: "12", cy: "12", r: "3" }],
  ],
  factory: [
    ["path", { d: "M3 21V10l5 3V10l5 3V6h4l1 15z" }],
    ["path", { d: "M3 21h18" }],
  ],
  file: [
    ["path", { d: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" }],
    ["path", { d: "M14 3v6h6M8 13h8M8 17h5" }],
  ],
  flag: [["path", { d: "M5 21V4M5 4h13l-2.5 4.5L18 13H5" }]],
  flame: [
    [
      "path",
      {
        d: "M12 22a6 6 0 0 0 6-6c0-4-3-6-4-9-1 2-2 3-3.5 3.5C9 8 9 5 10 3 6 5 6 10 6 12v4a6 6 0 0 0 6 6z",
      },
    ],
  ],
  folder: [
    ["path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
  ],
  gauge: [
    ["path", { d: "M12 14l4-4" }],
    ["path", { d: "M3.3 19a9 9 0 1 1 17.4 0" }],
  ],
  grid: [
    ["rect", { x: "4", y: "4", width: "7", height: "7", rx: "1.5" }],
    ["rect", { x: "13", y: "4", width: "7", height: "7", rx: "1.5" }],
    ["rect", { x: "4", y: "13", width: "7", height: "7", rx: "1.5" }],
    ["rect", { x: "13", y: "13", width: "7", height: "7", rx: "1.5" }],
  ],
  home: [
    ["path", { d: "M3 10.5 12 3l9 7.5" }],
    ["path", { d: "M5 9.5V21h14V9.5" }],
    ["path", { d: "M10 21v-6h4v6" }],
  ],
  inbox: [
    ["path", { d: "M3 13h5l1.5 3h5L16 13h5" }],
    ["path", { d: "M5 5h14l2 8v6H3v-6z" }],
  ],
  kanban: [
    ["rect", { x: "3", y: "4", width: "5", height: "16", rx: "1.5" }],
    ["rect", { x: "10", y: "4", width: "5", height: "10", rx: "1.5" }],
    ["rect", { x: "17", y: "4", width: "4", height: "13", rx: "1.5" }],
  ],
  layers: [
    ["path", { d: "m12 3 9 5-9 5-9-5z" }],
    ["path", { d: "m3 13 9 5 9-5" }],
  ],
  link: [
    ["path", { d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" }],
    ["path", { d: "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" }],
  ],
  list: [["path", { d: "M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" }]],
  loader: [["path", { d: "M12 3a9 9 0 1 0 9 9" }]],
  lock: [
    ["rect", { x: "5", y: "11", width: "14", height: "10", rx: "2" }],
    ["path", { d: "M8 11V7a4 4 0 0 1 8 0v4" }],
  ],
  map: [
    ["path", { d: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" }],
    ["path", { d: "M9 4v14M15 6v14" }],
  ],
  maximize: [["path", { d: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" }]],
  menu: [["path", { d: "M4 7h16M4 12h16M4 17h16" }]],
  minus: [["path", { d: "M5 12h14" }]],
  moon: [["path", { d: "M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2z" }]],
  palette: [
    [
      "path",
      {
        d: "M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-1-1.5-1-2.5 1-2 2-2h2a4 4 0 0 0 4-4c0-4.4-4-7.5-9-7.5z",
      },
    ],
    ["circle", { cx: "7.5", cy: "11", r: "1" }],
    ["circle", { cx: "10", cy: "7", r: "1" }],
    ["circle", { cx: "15", cy: "7.5", r: "1" }],
  ],
  panelClose: [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }],
    ["path", { d: "M9 4v16M16 10l-2 2 2 2" }],
  ],
  panelOpen: [
    ["rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }],
    ["path", { d: "M9 4v16M14 10l2 2-2 2" }],
  ],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  radar: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["circle", { cx: "12", cy: "12", r: "5" }],
    ["path", { d: "M12 12 18 6" }],
  ],
  rocket: [
    ["path", { d: "M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2" }],
    ["path", { d: "M9 15l-3-3c1-5 5.5-9 13-9 0 7.5-4 12-9 13z" }],
    ["circle", { cx: "15", cy: "9", r: "1.5" }],
  ],
  rotate: [
    ["path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }],
    ["path", { d: "M3 3v5h5" }],
  ],
  search: [
    ["circle", { cx: "11", cy: "11", r: "7" }],
    ["path", { d: "m20 20-4-4" }],
  ],
  settings: [
    ["circle", { cx: "12", cy: "12", r: "3" }],
    [
      "path",
      {
        d: "M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
      },
    ],
  ],
  shield: [["path", { d: "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z" }]],
  sparkles: [
    ["path", { d: "M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" }],
    ["path", { d: "M19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" }],
  ],
  stairs: [
    ["path", { d: "M4 20h4v-4h4v-4h4V8h4" }],
    ["path", { d: "M15 4h5v5" }],
  ],
  star: [["path", { d: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" }]],
  sun: [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    [
      "path",
      {
        d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
      },
    ],
  ],
  target: [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["circle", { cx: "12", cy: "12", r: "5" }],
    ["circle", { cx: "12", cy: "12", r: "1" }],
  ],
  terminal: [["path", { d: "m4 17 6-5-6-5M12 19h8" }]],
  trash: [["path", { d: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" }]],
  trophy: [
    ["path", { d: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" }],
    ["path", { d: "M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" }],
  ],
  users: [
    ["circle", { cx: "9", cy: "8", r: "3.5" }],
    ["path", { d: "M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" }],
    ["path", { d: "M16 4a3.5 3.5 0 0 1 0 7M21 20c0-2.6-1.6-4.9-4-5.7" }],
  ],
  x: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
} as const satisfies Record<string, readonly IconNode[]>;

export type IconName = keyof typeof ICON_NODES;
