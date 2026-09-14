// Turns a failed request into words a student, driver or admin can act on.
//
// Every screen puts `(e as Error).message` straight into its error text, so
// the message on the ApiError that apiFetch throws is the text people read.
// The API already answers in plain English; this covers everything that is
// not the API talking — no connection, a proxy error page, an empty body, or a
// stray technical message from an older server.

export const NETWORK_MESSAGE =
  "Can't connect right now. Check your internet connection and try again.";
export const UNEXPECTED_REPLY_MESSAGE =
  "The reply from the server could not be read. Please try again.";

const UNAVAILABLE_MESSAGE =
  "The server is not available right now. Please try again in a moment.";
const SERVER_ERROR_MESSAGE =
  "Something went wrong on our side. Please try again in a moment.";

const BY_STATUS: Record<number, string> = {
  400: "Some details are not right. Please check and try again.",
  401: "Please sign in again.",
  403: "You don't have permission to do this.",
  404: "We couldn't find what you were looking for.",
  409: "This clashes with something that already exists.",
  413: "This upload is too large. Please choose a smaller file.",
  429: "Too many attempts. Please wait a moment and try again.",
};

// Wording that only a program would write: database and parser errors, code
// identifiers, stack-trace vocabulary.
const TECHNICAL =
  /cast to \w+ failed|validation failed|E11000|duplicate key|ObjectId|unexpected token|unexpected end|JSON|\bat path\b|internal server error|TypeError|ReferenceError|is not a function|\bundefined\b|entity too large|<\/?[a-z][\s\S]*>/i;

/** True when `message` is safe to show a person as-is. */
export function isReadableMessage(message: unknown): message is string {
  return (
    typeof message === "string" &&
    message.trim().length > 0 &&
    message.length <= 300 &&
    !TECHNICAL.test(message)
  );
}

/** The message to show for a failed response with this status and body. */
export function messageForResponse(status: number, serverMessage: unknown): string {
  if (isReadableMessage(serverMessage)) return serverMessage;
  if (status === 502 || status === 503 || status === 504) return UNAVAILABLE_MESSAGE;
  if (status >= 500) return SERVER_ERROR_MESSAGE;
  return BY_STATUS[status] ?? "Something went wrong. Please try again.";
}
