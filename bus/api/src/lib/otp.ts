// Shared OTP generator. In non-production environments returns a fixed
// "0000" so every login can be tested without hunting for the log output.
// Any real deployment (NODE_ENV=production) falls through to a random
// 4-digit code.
export function generateOtp(): string {
  if (process.env.NODE_ENV !== "production") return "0000";
  return Math.floor(1000 + Math.random() * 9000).toString();
}
