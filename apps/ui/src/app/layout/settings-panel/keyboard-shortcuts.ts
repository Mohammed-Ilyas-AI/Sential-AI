/** The shortcuts the shell actually binds; the settings panel lists exactly these. */
export const KEYBOARD_SHORTCUTS: readonly { readonly keys: string; readonly action: string }[] = [
  { keys: 'Ctrl K', action: 'Command palette' },
  { keys: 'Ctrl B', action: 'Toggle navigation rail' },
  { keys: 'Ctrl .', action: 'Toggle focus mode' },
  { keys: 'Ctrl Shift P', action: 'Performance panel' },
  { keys: 'Esc', action: 'Close panel' },
];
