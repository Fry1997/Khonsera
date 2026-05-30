# Layer 5: Pattern recognisers

These are pattern specifications, not finite dictionary entries.

The engine should use a date/time parsing library such as chrono-node or an equivalent maintained parser. It should not hand-roll broad regex for natural-language time and date interpretation.

Every recognised pattern should preserve:

```yaml
source_text: original substring
normalised_value: parsed machine-readable value where available
confidence: high | medium | low
fuzzy: true | false
range: true | false
granularity: exact | minute | hour | day | week | month | period | fuzzy
```

---

## Times

Valid input includes:

```text
8pm
8 pm
20:00
08:30
8:30am
8.30am
half past eight
quarter past eight
quarter to nine
eight in the morning
eight at night
morning
afternoon
lunchtime
evening
tonight
first thing
end of the day
close of play
```

Engine behaviour:

```yaml
pattern_type: time
recognises:
  - exact clock times
  - natural-language clock times
  - named day periods
  - fuzzy time periods
flags:
  exact_time:
    examples: [8pm, 20:00, 8:30am]
    fuzzy: false
    range: false
    granularity: minute
  natural_time:
    examples: [half past eight, quarter to nine]
    fuzzy: false
    range: false
    granularity: minute
  day_period:
    examples: [morning, afternoon, evening, lunchtime, tonight]
    fuzzy: true
    range: true
    granularity: period
notes:
  - Named periods should produce ranges, not single timestamps.
  - "tonight" should usually bind to the current local date unless a future date is already active in context.
  - "close of play" should be treated as fuzzy and business-context dependent.
```

---

## Dates

Valid input includes:

```text
today
tomorrow
yesterday
next Thursday
this Friday
on Friday
the 22nd
22 June
22nd June
22-23 June
22 to 23 June
next week
this weekend
in two weeks
mid-June
early July
late August
the week after next
```

Engine behaviour:

```yaml
pattern_type: date
recognises:
  - explicit dates
  - relative dates
  - weekday references
  - date ranges
  - fuzzy month sections
  - weekend and week references
flags:
  exact_date:
    examples: [22 June, 22nd June]
    fuzzy: false
    range: false
    granularity: day
  relative_date:
    examples: [tomorrow, next Thursday, this Friday, in two weeks]
    fuzzy: false
    range: false
    granularity: day
  date_range:
    examples: [22-23 June, 22 to 23 June, this weekend]
    fuzzy: false
    range: true
    granularity: day
  fuzzy_date:
    examples: [mid-June, early July, late August, next week]
    fuzzy: true
    range: true
    granularity: week_or_month_section
notes:
  - Relative dates must resolve against the user's local timezone.
  - Ambiguous references such as "the 22nd" should inherit month/year from context if available.
  - If month/year cannot be resolved safely, retain the text and mark low-confidence rather than guessing.
  - Ranges must produce start and end values.
```

---

## Durations

Valid input includes:

```text
an hour
half an hour
90 minutes
two hours
two days
overnight
all day
for the weekend
for three nights
for two weeks
a few hours
a couple of days
```

Engine behaviour:

```yaml
pattern_type: duration
recognises:
  - minute-based durations
  - hour-based durations
  - day-based durations
  - night-based durations
  - vague durations
flags:
  exact_duration:
    examples: [90 minutes, two hours, two days]
    fuzzy: false
    range: false
    granularity: minute_or_hour_or_day
  overnight_duration:
    examples: [overnight, for three nights]
    fuzzy: false
    range: true
    granularity: night
  vague_duration:
    examples: [a few hours, a couple of days]
    fuzzy: true
    range: true
    granularity: fuzzy
notes:
  - Durations should attach to the nearest relevant event unless explicitly scoped.
  - "Overnight" should imply a date boundary or accommodation context when available.
  - "All day" should produce a day-period range, not a precise duration unless calendar bounds are configured.
```

---

## Money

Valid input includes:

```text
£38.50
38 pounds
around £100
about £100
roughly £100
no more than £200
under £50
less than £50
over £100
more than £100
cheap
budget
premium
expensive
first class
standard class
```

Engine behaviour:

```yaml
pattern_type: money
recognises:
  - exact monetary amounts
  - approximate monetary amounts
  - upper bounds
  - lower bounds
  - qualitative price preferences
flags:
  exact_amount:
    examples: [£38.50, 38 pounds]
    fuzzy: false
    range: false
    constraint: equals
  approximate_amount:
    examples: [around £100, about £100, roughly £100]
    fuzzy: true
    range: true
    constraint: approximate
  upper_bound:
    examples: [no more than £200, under £50, less than £50]
    fuzzy: false
    range: true
    constraint: maximum
  lower_bound:
    examples: [over £100, more than £100]
    fuzzy: false
    range: true
    constraint: minimum
  qualitative_price:
    examples: [cheap, budget, premium, expensive]
    fuzzy: true
    range: false
    constraint: preference
notes:
  - Currency should default to GBP only for UK-context users or UK-context journeys.
  - "Cheap", "budget", "premium", and "expensive" should be treated as preference flags, not numeric values.
  - Travel class words such as "first class" and "standard class" should attach to transport facts, not general money facts.
```

---

## Party sizes

Valid input includes:

```text
for two
for 2
table for four
table for 4
just me
only me
me only
solo
on my own
a group of six
group of 6
six people
two adults
two adults and one child
family of four
```

Engine behaviour:

```yaml
pattern_type: party_size
recognises:
  - explicit numeric party sizes
  - solo references
  - group references
  - adult/child breakdowns
flags:
  exact_party_size:
    examples: [for two, table for four, six people]
    fuzzy: false
    range: false
  solo:
    examples: [just me, only me, solo, on my own]
    fuzzy: false
    range: false
    party_size: 1
  group_size:
    examples: [a group of six, family of four]
    fuzzy: false
    range: false
  party_breakdown:
    examples: [two adults and one child]
    fuzzy: false
    range: false
notes:
  - Party sizes should attach primarily to meals, taxis, hotel bookings, and event bookings.
  - "Family of four" should create party_size: 4 but retain source_text because adult/child split is unknown.
  - Where a party size conflicts with a known standing fact, preserve both and mark for clarification.
```

---

## People references

Valid input includes:

```text
Sarah
Mark
Jamie
my wife
my husband
my partner
my son
my daughter
Jamie’s mum
Sarah's dad
the client
the customer
the team
the sales team
my manager
my colleague
the organiser
the driver
```

Engine behaviour:

```yaml
pattern_type: people_reference
recognises:
  - capitalised first names
  - possessive relationship structures
  - family relationship labels
  - work relationship labels
  - role-based references
flags:
  named_person:
    examples: [Sarah, Mark, Jamie]
    confidence: medium
    requires_runtime_resolution: true
  possessive_person:
    examples: [Jamie’s mum, Sarah's dad]
    confidence: medium
    requires_runtime_resolution: true
  family_reference:
    examples: [my wife, my husband, my son, my daughter, my partner]
    confidence: high
    requires_runtime_resolution: true
  work_reference:
    examples: [the client, the customer, the team, my manager, my colleague]
    confidence: medium
    requires_runtime_resolution: true
  role_reference:
    examples: [the organiser, the driver]
    confidence: medium
    requires_runtime_resolution: true
notes:
  - The dictionary should recognise the shape of a people reference, not resolve the identity.
  - Resolution belongs to contacts, standing facts, calendar context, or user profile data at runtime.
  - Capitalised words must not automatically be assumed to be people if already matched as places, operators, transport providers, or known organisations.
  - Role labels should be retained verbatim if not confidently resolvable.
```

---

## Implementation discipline

```yaml
principles:
  - Recognise less, not more.
  - Unknown words are preserved verbatim.
  - Ambiguous matches should be low-confidence or ignored.
  - Do not treat the dictionary as a general English parser.
  - Do not infer international places in v1.
  - Do not resolve venue names through this dictionary.
  - Do not create facts from casual words unless the travel/logistics meaning is clear.
  - Prefer explicit source_text retention over destructive normalisation.
  - Every interpreted value should keep a pointer back to the original user phrase.
```
