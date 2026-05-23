"use client";

export function BeHomeByField({
  value,
  onChange,
  defaultDate,
}: {
  value: { date: string; time: string } | null;
  onChange: (v: { date: string; time: string } | null) => void;
  defaultDate: string;
}) {
  return (
    <div className="brief-subcard">
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={value != null}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { date: defaultDate, time: "18:00" }
                : null,
            )
          }
        />
        <span className="uc" style={{ margin: 0 }}>
          Be home by
        </span>
      </label>
      {value != null && (
        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <input
            type="date"
            className="field"
            value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value })}
            style={{ flex: "1 1 140px" }}
          />
          <input
            type="time"
            className="field"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
            style={{ flex: "0 0 100px" }}
          />
        </div>
      )}
    </div>
  );
}
