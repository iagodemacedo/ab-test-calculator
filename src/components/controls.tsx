import type { ComponentChildren, JSX } from "preact";
import IconWarning from "~icons/ph/warning";
import type { Ui } from "../i18n/ui";
import type { FieldError } from "../app/parse";

export function Button({
  variant = "secondary",
  children,
  ...props
}: JSX.IntrinsicElements["button"] & {
  variant?: "primary" | "secondary" | "ghost";
  children: ComponentChildren;
}) {
  return (
    <button
      type="button"
      {...props}
      class={`button ${variant} ${props.class ?? ""}`}
    >
      {children}
    </button>
  );
}
export function NumberField({
  id,
  label,
  value,
  onInput,
  error,
  t,
  unit,
  compact = false,
}: {
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
  error: FieldError | undefined;
  t: Ui;
  unit?: string | undefined;
  compact?: boolean;
}) {
  return (
    <div class={`number-field ${compact ? "compact" : ""}`}>
      <label class={compact ? "mobile-label" : ""} for={id}>
        {label}
      </label>
      <div class="input-wrap" data-invalid={Boolean(error)}>
        <input
          id={id}
          role="spinbutton"
          type="text"
          inputMode="decimal"
          value={value}
          onInput={(e) => onInput(e.currentTarget.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {unit && <span class="unit">{unit}</span>}
      </div>
      {error && (
        <p id={`${id}-error`} class="field-error">
          <IconWarning aria-hidden="true" />
          {t[error]}
        </p>
      )}
    </div>
  );
}
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset class="segmented">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {options.map((option, i) => (
          <button
            type="button"
            role="radio"
            key={option.value}
            aria-checked={value === option.value}
            tabIndex={value === option.value ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (
                ![
                  "ArrowRight",
                  "ArrowLeft",
                  "ArrowDown",
                  "ArrowUp",
                  "Home",
                  "End",
                ].includes(e.key)
              )
                return;
              e.preventDefault();
              const index =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (i +
                        (e.key === "ArrowRight" || e.key === "ArrowDown"
                          ? 1
                          : -1) +
                        options.length) %
                      options.length;
              const next = options[index];
              if (next) {
                onChange(next.value);
                const buttons =
                  e.currentTarget.parentElement?.querySelectorAll("button");
                buttons?.[index]?.focus();
              }
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      class="toggle"
    >
      <span class="toggle-track" aria-hidden="true">
        <span />
      </span>
      <span>{label}</span>
    </button>
  );
}
export function Stat({
  label,
  value,
  note,
  hero = false,
  negative = false,
}: {
  label: string;
  value: string;
  note?: string | undefined;
  hero?: boolean;
  negative?: boolean;
}) {
  return (
    <div class={`stat ${hero ? "hero" : ""} ${negative ? "negative" : ""}`}>
      <span class="stat-label">{label}</span>
      <span class="stat-value">
        {hero
          ? value
              .split(/([,.])/)
              .map((part) =>
                part === "," || part === "." ? (
                  <span class="stat-decimal">{part}</span>
                ) : (
                  part
                ),
              )
          : value}
      </span>
      {note && <span class="stat-note">{note}</span>}
    </div>
  );
}
