// Logger central. Em produção, isso pode ser trocado por um sink remoto
// (ex: Sentry, Logtail) sem mudar as chamadas espalhadas pelo app.
const isDev = import.meta.env.DEV;

function base(level, ...args) {
  const ts = new Date().toISOString();
  const line = [`[${ts}]`, `[${level.toUpperCase()}]`, ...args];
  if (level === 'error') console.error(...line);
  else if (level === 'warn') console.warn(...line);
  else if (isDev) console.log(...line);
}

export const logger = {
  info: (...args) => base('info', ...args),
  warn: (...args) => base('warn', ...args),
  error: (...args) => base('error', ...args)
};
