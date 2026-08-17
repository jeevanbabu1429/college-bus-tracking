import { IconMail, IconPhone } from "./icons";

// Single source of truth for the support details shown on the auth screens.
export const SUPPORT_EMAIL = "twostackd@gmail.com";
export const SUPPORT_MOBILE = "9360555572";

// `tel:` wants an unpunctuated number; the +91 country code makes the link work
// from a phone abroad too.
export const SUPPORT_TEL = `+91${SUPPORT_MOBILE}`;
export const SUPPORT_MOBILE_DISPLAY = `+91 ${SUPPORT_MOBILE.slice(
  0,
  5
)} ${SUPPORT_MOBILE.slice(5)}`;

export function SupportContact({
  label = "Trouble signing in? Contact support",
}: {
  label?: string;
}) {
  return (
    <div className="support-contact">
      <span className="support-contact-label">{label}</span>
      <div className="support-contact-links">
        <a href={`mailto:${SUPPORT_EMAIL}`} className="support-contact-link">
          <IconMail size={14} />
          {SUPPORT_EMAIL}
        </a>
        <a href={`tel:${SUPPORT_TEL}`} className="support-contact-link">
          <IconPhone size={14} />
          {SUPPORT_MOBILE_DISPLAY}
        </a>
      </div>
    </div>
  );
}
