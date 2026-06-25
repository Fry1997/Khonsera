The charcoal data cell from physical signage — a platform / gate / seat number pressed into a dark plate. Use it for the single most operationally important number on a card so it reads as wayfinding, not body copy.

```jsx
<WayfindBadge>4</WayfindBadge>          {/* platform */}
<WayfindBadge>12C</WayfindBadge>        {/* seat */}
<WayfindBadge tone="soft">Gate 22</WayfindBadge>
```

`tone`: `dark` (charcoal plate, default) · `soft` (quiet gold cell). Pair with `StubField label="Platform" value="4" badge` to render it inside a boarding-pass read-out grid.
