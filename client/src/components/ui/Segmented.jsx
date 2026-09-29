import { useId } from 'react';

/** Radio-group styled as a segmented control. */
export function Segmented({ label, options, value, onChange }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.08] bg-ink-950/60 p-1">
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <label
              key={opt.value}
              className={`flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent ${
                checked ? 'bg-white/[0.1] text-ink-100' : 'text-ink-400 hover:text-ink-200'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.icon}
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
