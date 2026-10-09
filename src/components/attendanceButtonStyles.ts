const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy';
export const attendanceButtonBase = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors whitespace-nowrap ${focus}`;

/** Selected button ② appearance, shared by the app and Scenario Lab. */
export const attendanceButtonStyles = {
  mode: `${attendanceButtonBase} border border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-navy`,
  autoAssign: `${attendanceButtonBase} bg-[#33465b] text-white hover:bg-[#243649] disabled:cursor-wait disabled:opacity-60`,
  evaluation: `${attendanceButtonBase} bg-slate-100 text-navy hover:bg-slate-200`,
} as const;
