const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?<!\w)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\w)/g;
const SECRET_RE = /\b(token|access_token|refresh_token|id_token|api_key|secret|password)=([^\s&]+)/gi;
const BEARER_RE = /\bbearer\s+[A-Za-z0-9._~+/=-]+/gi;

function redactString(value: string): string {
  return value
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(PHONE_RE, "[REDACTED_PHONE]")
    .replace(BEARER_RE, "[REDACTED_BEARER_TOKEN]")
    .replace(SECRET_RE, "$1=[REDACTED_SECRET]");
}

function safeConsoleArg(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (value instanceof Error) return `${value.name}: ${redactString(value.message)}`;
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  return Object.prototype.toString.call(value);
}

export function installSafeConsole() {
  if (!import.meta.env.PROD) return;

  (["debug", "info", "warn", "error"] as const).forEach((method) => {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args.map(safeConsoleArg));
    };
  });
}
