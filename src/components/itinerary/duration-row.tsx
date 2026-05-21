"use client";

// Duration picker — a row of preset chips plus a free-form minute
// input. Used by Anchor.AppointmentTimes, Anchor.HotelTimes,
// Anchor.ReturnToRoom and StopoverCard. Fully controlled.

export function DurationRow({
  presets,
  value,
  onChange,
  label = "Duration",
}: {
  presets: Array<{ label: string; mins: number }>;
  value: number;
  onChange: (mins: number) => void;
  label?: string;
}) {
  const matched = presets.some((p) => p.mins === value);
  return (
    <div>
      <span className="uc">{label}</span>
      <div className="brief-pill-row" style={{ marginTop: 6 }}>
        {presets.map((d) => (
          <button
            key={d.label}
            type="button"
            className="pill brief-pill"
            data-active={d.mins === value}
            onClick={() => onChange(d.mins)}
          >
            {d.label}
          </button>
        ))}
        <span
          className="duration-custom"
          data-active={!matched}
          title="Type any number of minutes"
        >
          <input
            type="number"
            min={5}
            max={24 * 60}
            step={5}
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isNaN(v) && v >= 0) onChange(v);
            }}
            aria-label="Custom duration in minutes"
          />
          <span aria-hidden>min</span>
        </span>
      </div>
    </div>
  );
}
