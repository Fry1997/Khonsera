The mono uppercase status capsule — feasibility (`comfortable` / `tight` / `risky`) and lifecycle (`booked` / `planned` / `live` / `done` / `offline`) in one component. Quiet by default; `solid` fills the capsule for the loudest moments.

```jsx
<StatePill state="comfortable" />
<StatePill state="risky" solid>Connection missed</StatePill>
<StatePill state="live" dot={false} />
```

`state` sets both colour and default label. Pass `children` to override the label, `dot={false}` to drop the leading dot. Sage = comfortable/fits, amber = tight, rust = risky/disruption — the three feasibility colours the whole system reads delay against.
