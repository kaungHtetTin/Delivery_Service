const paths = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9h13v-9M9 19v-5h6v5",
  box: "m4 7 8-4 8 4-8 4-8-4Zm0 0v10l8 4 8-4V7m-8 4v10",
  plus: "M12 5v14m-7-7h14",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9m-8 13h4",
  user: "M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  grid: "M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z",
  bike: "M5 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 15h5l3-6h3l3 6m-9 0-3-6h3m3 0-2-3",
  card: "M3 6h18v12H3V6Zm0 4h18M7 15h4",
  chart: "M4 20V10m5 10V4m6 16v-7m5 7V7",
  settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-12v2m0 13v2m8.5-8.5h-2m-13 0h-2m14.5-6-1.5 1.5m-9 9L6 18m12 0-1.5-1.5m-9-9L6 6",
  search: "m21 21-4.3-4.3m2.3-5.2a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z",
  filter: "M4 6h16M7 12h10m-7 6h4",
  mapPin: "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Zm-8 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  chevronRight: "m9 18 6-6-6-6",
  chevronLeft: "m15 18-6-6 6-6",
  phone: "M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1.1-.2c1.2.6 2.6 1 4 1.2a1 1 0 0 1 .9 1V21a1 1 0 0 1-1 1C10.2 22 2 13.8 2 3.6a1 1 0 0 1 1-1h3.8a1 1 0 0 1 1 .9c.1 1.4.5 2.8 1.1 4a1 1 0 0 1-.2 1.1l-2.1 2.2Z",
  navigation: "m3 11 19-8-8 19-2.5-8.5L3 11Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  palette: "M12 3a9 9 0 1 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h5a4 4 0 0 0 4-4c0-3.9-4-7-9-7ZM7.5 11h.01M9.5 7.5h.01M14 7h.01M17 10h.01",
  sun: "M12 3v2m0 14v2m9-9h-2M5 12H3m15.4-6.4L17 7M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z",
  close: "M18 6 6 18M6 6l12 12",
  check: "m5 12 4 4L19 6",
  upload: "M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5",
  wallet: "M4 6h16v13H4V6Zm0 3h16m-4 5h.01",
  location: "M12 21s7-5.4 7-11A7 7 0 0 0 5 10c0 5.6 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  lock: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5V11Zm7 4v2",
  menu: "M4 6h16M4 12h16M4 18h16",
  mail: "M4 6h16v12H4V6Zm0 0 8 6 8-6",
};

export function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      aria-hidden="true"
      className={`icon ${className}`}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
    >
      <path d={paths[name]} />
    </svg>
  );
}
