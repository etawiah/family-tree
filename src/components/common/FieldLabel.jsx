/**
 * Reusable form field component with guidance, validation, and accessibility.
 *
 * Features:
 * - Clear label with required (*) or optional indicator
 * - Placeholder with example
 * - Help text explaining what to enter
 * - Character counter with dynamic color (green/yellow/red)
 * - Full accessibility support (aria-describedby, aria-invalid, aria-required)
 * - Error message display
 * - Works with text, textarea, date, select, checkbox inputs
 */
export default function FieldLabel({
  label,
  required = false,
  optional = false,
  helpText = "",
  error = "",
  children,
  fieldId = "",
  maxLength = null,
  currentLength = 0,
  touched = false,
}) {
  // Calculate character counter color
  const getCharacterCounterColor = () => {
    if (!maxLength || currentLength === 0) return "var(--color-text-muted)";
    const percentage = (currentLength / maxLength) * 100;
    if (percentage >= 100) return "var(--color-error)"; // Red at max
    if (percentage >= 80) return "var(--color-warning)"; // Yellow at 80%
    return "var(--color-success)"; // Green below 80%
  };

  // Build aria-describedby string
  const ariaDescribedBy = [
    helpText && `${fieldId}-help`,
    error && touched && `${fieldId}-error`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="form-field">
      {/* Field Header: Label + Required/Optional Indicator */}
      <div className="field-header">
        <span className="field-label">{label}</span>
        {required && <span className="required-indicator" aria-label="required">*</span>}
        {optional && !required && (
          <span className="optional-indicator">(Optional)</span>
        )}
      </div>

      {/* Input Element (passed as children) */}
      <div className="field-input-wrapper">
        {children({
          id: fieldId,
          "aria-describedby": ariaDescribedBy || undefined,
          "aria-invalid": error && touched ? "true" : "false",
          "aria-required": required ? "true" : "false",
        })}
      </div>

      {/* Field Footer: Help Text + Character Counter */}
      <div className="field-footer">
        {helpText && (
          <span id={`${fieldId}-help`} className="field-hint">
            {helpText}
          </span>
        )}
        {maxLength && (
          <span
            className="char-counter"
            style={{ color: getCharacterCounterColor() }}
          >
            {currentLength} / {maxLength}
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && touched && (
        <span
          id={`${fieldId}-error`}
          className="form-error"
          role="alert"
        >
          {error}
        </span>
      )}
    </label>
  );
}
