/**
 * The product's icon set: 24×24, 1.75 stroke, drawn for SENTINEL AI so no icon package ships to the browser.
 * Each entry is SVG path data; several subpaths may share one entry.
 */
export const ICON_PATHS = {
  menu: 'M4 7h16M4 12h16M4 17h10',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.5 7.5 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.6 7.6 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.6 7.6 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  chevronDown: 'm6 9 6 6 6-6',
  chevronRight: 'm9 6 6 6-6 6',
  chevronsLeft: 'm11 17-5-5 5-5M18 17l-5-5 5-5',
  chevronsRight: 'm13 17 5-5-5-5M6 17l5-5-5-5',
  close: 'M6 6l12 12M18 6 6 18',
  radar: 'M12 12 18 6M12 21a9 9 0 1 1 9-9M12 17a5 5 0 1 1 5-5M12 12h.01',
  activity: 'M3 12h4l2.5-6 5 12L17 12h4',
  alert: 'M12 4 2.8 19.5h18.4L12 4Zm0 6v4m0 3h.01',
  investigate: 'M10 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm4.5-1.5L20 21M8 11h4M10 9v4',
  network:
    'M12 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM5 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm14 0a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM11 7.8 6.3 16.2M13 7.8l4.7 8.4M7.5 18.5h9',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  intervention: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-2 6.5v5m4-5v5',
  policy: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9 2.2 2.2 4.2-4.4',
  analytics: 'M4 20h16M7 16v-4m5 4V7m5 9v-6',
  integrations: 'M9 7V3m6 4V3M7 7h10v4a5 5 0 0 1-10 0V7Zm5 9v5',
  audit: 'M7 3h7l4 4v14H7V3Zm7 0v4h4M10 12h5m-5 4h5',
  command: 'M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6Z',
  arrowRight: 'M5 12h14m-6-6 6 6-6 6',
  arrowUpRight: 'M7 17 17 7m-8 0h8v8',
  arrowDownRight: 'M7 7l10 10m0-8v8H9',
  trendUp: 'M4 16l6-6 4 4 6-6m-5 0h5v5',
  trendDown: 'M4 8l6 6 4-4 6 6m-5 0h5v-5',
  minus: 'M6 12h12',
  plus: 'M12 6v12M6 12h12',
  bank: 'M3 9.5 12 4l9 5.5M5 10v8m4.7-8v8m4.6-8v8M19 10v8M3.5 20.5h17',
  transfer: 'M5 8h13m-4-4 4 4-4 4M19 16H6m4 4-4-4 4-4',
  shieldAlert: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm0 5.5v4m0 3h.01',
  shieldCheck: 'M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-3.2 9 2.2 2.2 4.2-4.4',
  explain: 'M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17M17 7l1.4-1.4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  expand: 'M14 4h6v6M10 20H4v-6m16-10-7 7M4 20l7-7',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  focus: 'M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4m8-1a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 21ZM7.5 12h.01M10 8h.01M15 8h.01',
  keyboard: 'M3 6h18v12H3V6Zm4 4h.01M11 10h.01M15 10h.01M7 14h10',
  server: 'M4 4h16v6H4V4Zm0 10h16v6H4v-6Zm4-7h.01M8 17h.01',
  environment: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3Z',
  check: 'm5 12.5 4.5 4.5L19 7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4.5l3 2',
  chevronRightSmall: 'm10 8 4 4-4 4',
  lock: 'M6 11h12v10H6V11Zm2.5 0V8a3.5 3.5 0 0 1 7 0v3',
} as const;

export type IconName = keyof typeof ICON_PATHS;
