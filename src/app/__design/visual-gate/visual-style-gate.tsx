"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CarFront,
  ChevronRight,
  CloudSun,
  MapPin,
  MessageCircle,
  Navigation,
  Plane,
  Ticket,
  TrainFront,
  Users,
} from "lucide-react";
import styles from "./visual-gate.module.css";

type Direction = "luxury" | "instrument" | "editorial";
type Scenario = "normal" | "adaptive" | "disruption";
type Viewport = "phone" | "wide";

const DIRECTIONS: Array<{
  id: Direction;
  label: string;
  note: string;
}> = [
  {
    id: "luxury",
    label: "Quiet luxury",
    note: "Airy, tactile, restrained. Information appears progressively.",
  },
  {
    id: "instrument",
    label: "Executive instrument",
    note: "Dark, precise and modular. High information capacity without SaaS colour.",
  },
  {
    id: "editorial",
    label: "Editorial utility",
    note: "Light, graphic and structured. Dense widgets live inside a calm grid.",
  },
];

const SCENARIOS: Array<{ id: Scenario; label: string }> = [
  { id: "normal", label: "Normal day" },
  { id: "adaptive", label: "Adaptive day" },
  { id: "disruption", label: "Disruption" },
];

type PreviewProps = {
  direction: Direction;
  scenario: Scenario;
  viewport: Viewport;
  compact?: boolean;
};

function TravelPreview({ direction, scenario, viewport, compact = false }: PreviewProps) {
  const disrupted = scenario === "disruption";
  const adaptive = scenario === "adaptive";

  const command = useMemo(() => {
    if (disrupted) {
      return {
        eyebrow: "Plan changed",
        title: "Take the 08:42 instead",
        time: "18",
        unit: "min",
        detail: "The 08:27 is delayed 16 min. Switching protects your London connection.",
        status: "Re-plan ready",
      };
    }

    if (adaptive) {
      return {
        eyebrow: "Next move",
        title: "Leave for Wellingborough",
        time: "24",
        unit: "min",
        detail: "Traffic is building on the A509. Leaving 6 minutes earlier keeps your rail buffer intact.",
        status: "Adjusted for traffic",
      };
    }

    return {
      eyebrow: "Next move",
      title: "Leave for Wellingborough",
      time: "30",
      unit: "min",
      detail: "Your train is on time. You have a comfortable station buffer.",
      status: "On track",
    };
  }, [adaptive, disrupted]);

  return (
    <div
      className={styles.preview}
      data-direction={direction}
      data-viewport={viewport}
      data-compact={compact || undefined}
    >
      <div className={styles.frame}>
        <header className={styles.appbar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>K</span>
            <span>KHONSERA</span>
          </div>
          <div className={styles.appbarMeta}>
            <span>Sunday · 20 Sep</span>
            <span className={styles.avatar}>CF</span>
          </div>
        </header>

        <main className={styles.canvas}>
          <section className={styles.dayHead}>
            <div>
              <span className={styles.kicker}>TODAY · LONDON</span>
              <h1>Work in the city</h1>
              <p>Home → Wellingborough → St Pancras → Clerkenwell</p>
            </div>
            <div className={styles.weather}>
              <CloudSun aria-hidden />
              <strong>18°</strong>
              <span>Dry until 16:00</span>
            </div>
          </section>

          <section className={styles.command} data-alert={disrupted || undefined}>
            <div className={styles.commandCopy}>
              <span className={styles.kicker}>{command.eyebrow}</span>
              <h2>{command.title}</h2>
              <p>{command.detail}</p>
              <div className={styles.statusLine}>
                <span className={styles.statusDot} />
                <span>{command.status}</span>
              </div>
            </div>
            <div className={styles.countdown}>
              <strong>{command.time}</strong>
              <span>{command.unit}</span>
            </div>
            <button className={styles.primaryAction} type="button">
              {disrupted ? "Accept new plan" : "Start journey"}
              <ArrowRight aria-hidden />
            </button>
          </section>

          <section className={styles.widgetGrid} aria-label="Adaptive travel widgets">
            <article className={styles.widget}>
              <span className={styles.widgetIcon}><TrainFront aria-hidden /></span>
              <div>
                <span className={styles.widgetLabel}>Rail</span>
                <strong>{disrupted ? "08:42" : "08:27"}</strong>
                <small>{disrupted ? "Platform 1 · alternative" : "Platform 2 · on time"}</small>
              </div>
            </article>

            <article className={styles.widget}>
              <span className={styles.widgetIcon}><Ticket aria-hidden /></span>
              <div>
                <span className={styles.widgetLabel}>Ticket</span>
                <strong>Anytime</strong>
                <small>Barcode ready</small>
              </div>
            </article>

            <article className={styles.widget}>
              <span className={styles.widgetIcon}><Navigation aria-hidden /></span>
              <div>
                <span className={styles.widgetLabel}>Arrival</span>
                <strong>{disrupted ? "10:08" : adaptive ? "09:48" : "09:42"}</strong>
                <small>Clerkenwell · 12 min walk</small>
              </div>
            </article>

            <article className={styles.widget}>
              <span className={styles.widgetIcon}><BriefcaseBusiness aria-hidden /></span>
              <div>
                <span className={styles.widgetLabel}>First commitment</span>
                <strong>10:30</strong>
                <small>32 min protected</small>
              </div>
            </article>

            {adaptive || disrupted ? (
              <article className={styles.widget} data-emphasis="true">
                <span className={styles.widgetIcon}>
                  {disrupted ? <AlertTriangle aria-hidden /> : <CarFront aria-hidden />}
                </span>
                <div>
                  <span className={styles.widgetLabel}>{disrupted ? "Watch" : "Traffic"}</span>
                  <strong>{disrupted ? "Connection protected" : "+6 min"}</strong>
                  <small>{disrupted ? "Khonsera has moved the rail leg" : "Leave earlier than planned"}</small>
                </div>
              </article>
            ) : null}

            {adaptive ? (
              <article className={styles.widget}>
                <span className={styles.widgetIcon}><MessageCircle aria-hidden /></span>
                <div>
                  <span className={styles.widgetLabel}>Partner update</span>
                  <strong>Ready</strong>
                  <small>Share revised arrival in one tap</small>
                </div>
              </article>
            ) : null}
          </section>

          <div className={styles.mainGrid}>
            <section className={styles.itinerary}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.kicker}>ITINERARY</span>
                  <h3>The day, held together</h3>
                </div>
                <button type="button">View full plan</button>
              </div>

              <div className={styles.timeline}>
                <div className={styles.timelineItem} data-active="true">
                  <span className={styles.timelineGlyph}><CarFront aria-hidden /></span>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineTime}>{adaptive ? "07:35" : "07:41"}</span>
                    <strong>Drive to Wellingborough</strong>
                    <small>22 min · Car park B</small>
                  </div>
                  <span className={styles.timelineMeta}>{adaptive ? "Leave early" : "Planned"}</span>
                </div>

                <div className={styles.timelineItem} data-alert={disrupted || undefined}>
                  <span className={styles.timelineGlyph}><TrainFront aria-hidden /></span>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineTime}>{disrupted ? "08:42" : "08:27"}</span>
                    <strong>Wellingborough → London St Pancras</strong>
                    <small>{disrupted ? "Alternative selected · platform 1" : "55 min · platform 2"}</small>
                  </div>
                  <span className={styles.timelineMeta}>{disrupted ? "Changed" : "Live"}</span>
                </div>

                <div className={styles.timelineItem}>
                  <span className={styles.timelineGlyph}><MapPin aria-hidden /></span>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineTime}>{disrupted ? "09:54" : "09:30"}</span>
                    <strong>Walk to Clerkenwell</strong>
                    <small>12 min · quieter route</small>
                  </div>
                  <span className={styles.timelineMeta}>12 min</span>
                </div>

                <div className={styles.timelineItem}>
                  <span className={styles.timelineGlyph}><Users aria-hidden /></span>
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineTime}>10:30</span>
                    <strong>Customer meeting</strong>
                    <small>Sessions House · 75 min</small>
                  </div>
                  <span className={styles.timelineMeta}>Fixed</span>
                </div>
              </div>
            </section>

            <aside className={styles.contextRail}>
              <article className={styles.contextCard}>
                <div className={styles.contextTop}>
                  <span className={styles.contextIcon}><CalendarDays aria-hidden /></span>
                  <span className={styles.kicker}>DAY AHEAD</span>
                </div>
                <strong>Nothing needs your attention after arrival.</strong>
                <p>Dinner is confirmed for 19:30 and your return train has 18 minutes of station margin.</p>
                <button type="button">See evening <ChevronRight aria-hidden /></button>
              </article>

              <article className={styles.contextCard}>
                <div className={styles.contextTop}>
                  <span className={styles.contextIcon}><Plane aria-hidden /></span>
                  <span className={styles.kicker}>WALLET</span>
                </div>
                <strong>3 travel documents ready</strong>
                <p>Rail barcode, hotel confirmation and return ticket are saved offline.</p>
                <button type="button">Open wallet <ChevronRight aria-hidden /></button>
              </article>
            </aside>
          </div>
        </main>

        <nav className={styles.tabbar} aria-label="Preview navigation">
          <button type="button" data-active="true">
            <CalendarDays aria-hidden />
            <span>Today</span>
          </button>
          <button type="button">
            <MapPin aria-hidden />
            <span>Plan</span>
          </button>
          <button type="button">
            <Navigation aria-hidden />
            <span>Navigate</span>
          </button>
          <button type="button">
            <Ticket aria-hidden />
            <span>Wallet</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

export function VisualStyleGate() {
  const [direction, setDirection] = useState<Direction>("editorial");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [viewport, setViewport] = useState<Viewport>("phone");
  const [compare, setCompare] = useState(false);

  return (
    <div className={styles.lab}>
      <header className={styles.labHeader}>
        <div>
          <span className={styles.labEyebrow}>KHONSERA DESIGN LAB</span>
          <h1>Visual style gate</h1>
          <p>
            Keep the product problem identical. Change only the visual system, then stress it with adaptive and disrupted states.
          </p>
        </div>
        <div className={styles.referenceNote}>
          <strong>What we are testing</strong>
          <span>Can the interface feel premium while still carrying live, adaptive travel intelligence?</span>
        </div>
      </header>

      <div className={styles.controls}>
        <fieldset>
          <legend>Direction</legend>
          <div className={styles.segmented}>
            {DIRECTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={!compare && direction === item.id || undefined}
                onClick={() => {
                  setDirection(item.id);
                  setCompare(false);
                }}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              data-active={compare || undefined}
              onClick={() => setCompare(true)}
            >
              Compare
            </button>
          </div>
        </fieldset>

        <fieldset>
          <legend>Stress state</legend>
          <div className={styles.segmented}>
            {SCENARIOS.map((item) => (
              <button
                key={item.id}
                type="button"
                data-active={scenario === item.id || undefined}
                onClick={() => setScenario(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        {!compare ? (
          <fieldset>
            <legend>Viewport</legend>
            <div className={styles.segmented}>
              <button
                type="button"
                data-active={viewport === "phone" || undefined}
                onClick={() => setViewport("phone")}
              >
                Phone
              </button>
              <button
                type="button"
                data-active={viewport === "wide" || undefined}
                onClick={() => setViewport("wide")}
              >
                Wide
              </button>
            </div>
          </fieldset>
        ) : null}
      </div>

      {!compare ? (
        <div className={styles.singleStage}>
          <div className={styles.directionBrief}>
            <strong>{DIRECTIONS.find((item) => item.id === direction)?.label}</strong>
            <span>{DIRECTIONS.find((item) => item.id === direction)?.note}</span>
          </div>
          <TravelPreview direction={direction} scenario={scenario} viewport={viewport} />
        </div>
      ) : (
        <div className={styles.compareGrid}>
          {DIRECTIONS.map((item) => (
            <section className={styles.compareCell} key={item.id}>
              <div className={styles.directionBrief}>
                <strong>{item.label}</strong>
                <span>{item.note}</span>
              </div>
              <TravelPreview
                direction={item.id}
                scenario={scenario}
                viewport="phone"
                compact
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
