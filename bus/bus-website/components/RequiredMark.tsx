// Red asterisk shown inside a .field-label to mark a mandatory field.
//
// Visual-only on purpose: it's `aria-hidden` so screen readers don't announce a
// stray "star". They learn the field is mandatory from the control's own
// `required` / `aria-required` attribute instead.
export function RequiredMark() {
  return (
    <span className="required" aria-hidden>
      *
    </span>
  );
}

// One-line legend explaining the asterisk. Pair it with the marks above.
export function RequiredLegend() {
  return (
    <p className="small muted" style={{ marginBottom: 18 }}>
      Fields marked <span className="required">*</span> are required.
    </p>
  );
}
