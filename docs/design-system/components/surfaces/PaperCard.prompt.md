The workhorse surface — a single sheet of heavy cotton stock that lifts off the desk, with the paper tooth and letterpress text baked in. `dark` gives the same stock in charcoal (Live, premium tickets, dark wayfinding plates). Everything in Khonsera is built on this.

```jsx
<PaperCard padding={18}>
  <h3 className="h3">St Pancras</h3>
  <p className="small">Euston Road, N1C</p>
</PaperCard>

<PaperCard dark radius="hero">…charcoal plate…</PaperCard>
```

`radius`: `hero` 18 · `tile` 14 (default) · `inner` 11, or a px number. `elevation`: `lift` (default) or `sm`. Pair a lifted card with a sunk `Well` inside it to tell a clear level story.
