import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  Clock3,
  ExternalLink,
  Monitor,
  PlayCircle,
  Smartphone,
  Wrench,
} from "lucide-react";
import { PageShell } from "@/components/ui/page-shell";
import { requireUserContext } from "@/lib/auth";

export const revalidate = 15;

const REPO = "Fry1997/Khonsera";
const WORKFLOW_URL =
  "https://github.com/Fry1997/Khonsera/actions/workflows/qa-observatory.yml";
const RELEASE_PREFIX = "qa-observer-";

type GithubAsset = {
  id: number;
  name: string;
  browser_download_url: string;
  size: number;
};

type GithubRelease = {
  id: number;
  tag_name: string;
  name: string | null;
  html_url: string;
  published_at: string | null;
  assets: GithubAsset[];
};

type WorkflowRun = {
  id: number;
  status: "queued" | "in_progress" | "completed" | string;
  conclusion: string | null;
  html_url: string;
  run_number: number;
  created_at: string;
};

type WorkflowRunsResponse = {
  workflow_runs: WorkflowRun[];
};

type LiveRelayState = {
  status: string;
  viewportName: string;
  commandCount: number;
  maxCommands: number;
  updatedAt: string;
  url: string;
  liveScreenshot: string;
};

const githubHeaders = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

async function githubJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: githubHeaders,
      next: { revalidate: 15 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function getObservatoryData() {
  const [runData, releases] = await Promise.all([
    githubJson<WorkflowRunsResponse>(
      `https://api.github.com/repos/${REPO}/actions/workflows/qa-observatory.yml/runs?per_page=1`,
    ),
    githubJson<GithubRelease[]>(
      `https://api.github.com/repos/${REPO}/releases?per_page=20`,
    ),
  ]);

  const latestWorkflowRun = runData?.workflow_runs?.[0] ?? null;
  let liveRelay: LiveRelayState | null = null;

  if (latestWorkflowRun && latestWorkflowRun.status !== "completed") {
    liveRelay = await githubJson<LiveRelayState>(
      `https://raw.githubusercontent.com/${REPO}/qa-live-${latestWorkflowRun.id}/qa-live/state.json`,
    );
  }

  return {
    latestWorkflowRun,
    liveRelay,
    observerReleases:
      releases?.filter((release) =>
        release.tag_name.startsWith(RELEASE_PREFIX),
      ).slice(0, 8) ?? [],
  };
}

function dateLabel(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function bytesLabel(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
}

function runState(run: WorkflowRun | null) {
  if (!run) {
    return {
      label: "No cloud run found",
      detail: "Start the first traveller run from GitHub Actions.",
      tone: "var(--ink-dim)",
    };
  }

  if (run.status === "queued") {
    return {
      label: "Queued",
      detail: `Cloud run #${run.run_number} is waiting for a runner.`,
      tone: "var(--gold-2)",
    };
  }

  if (run.status === "in_progress") {
    return {
      label: "Running now",
      detail: `Cloud run #${run.run_number} is driving Khonsera.`,
      tone: "var(--terra)",
    };
  }

  if (run.conclusion === "success") {
    return {
      label: "Completed",
      detail: `Cloud run #${run.run_number} finished successfully.`,
      tone: "var(--sage)",
    };
  }

  return {
    label: run.conclusion ? `Completed · ${run.conclusion}` : "Completed",
    detail: `Cloud run #${run.run_number} finished. Its evidence is still kept.`,
    tone: "var(--rust)",
  };
}

function asset(release: GithubRelease, name: string) {
  return release.assets.find((candidate) => candidate.name === name) ?? null;
}

function traceUrl(downloadUrl: string) {
  return `https://trace.playwright.dev/?trace=${encodeURIComponent(downloadUrl)}`;
}

function Recording({
  title,
  description,
  video,
  trace,
  relay,
  actions,
  icon,
}: {
  title: string;
  description: string;
  video: GithubAsset | null;
  trace: GithubAsset | null;
  relay: GithubAsset | null;
  actions: GithubAsset | null;
  icon: React.ReactNode;
}) {
  if (!video && !trace && !relay) return null;

  return (
    <article className="j-card overflow-hidden">
      <div className="flex items-start gap-3 border-b border-black/10 p-4">
        <div
          className="mt-0.5 rounded-full p-2"
          style={{ background: "var(--paper-2)", color: "var(--terra)" }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="h3">{title}</h3>
          <p className="small mt-1">{description}</p>
        </div>
      </div>

      {video ? (
        <div className="bg-black">
          <video
            className="aspect-video w-full"
            controls
            playsInline
            preload="metadata"
            src={video.browser_download_url}
          >
            Your browser cannot play this Playwright recording.
          </video>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 p-4">
        {video ? (
          <a
            href={video.browser_download_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            <PlayCircle size={16} aria-hidden="true" />
            Open recording
            {video.size ? (
              <span className="tiny opacity-70">{bytesLabel(video.size)}</span>
            ) : null}
          </a>
        ) : null}
        {trace ? (
          <a
            href={traceUrl(trace.browser_download_url)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            <Wrench size={16} aria-hidden="true" />
            Inspect trace
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
        {relay ? (
          <a
            href={relay.browser_download_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            Relay result
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
        {actions ? (
          <a
            href={actions.browser_download_url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
          >
            Action log
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

export default async function QaObservatoryPage() {
  const ctx = await requireUserContext();
  if (!ctx.isStaff && !ctx.isAdmin) notFound();

  const { latestWorkflowRun, liveRelay, observerReleases } = await getObservatoryData();
  const state = runState(latestWorkflowRun);
  const latest = observerReleases[0] ?? null;

  const desktopVideo = latest ? asset(latest, "desktop-chromium.webm") : null;
  const desktopTrace = latest
    ? asset(latest, "desktop-chromium-trace.zip")
    : null;
  const mobileVideo = latest ? asset(latest, "mobile-390.webm") : null;
  const mobileTrace = latest ? asset(latest, "mobile-390-trace.zip") : null;
  const desktopRelay = latest ? asset(latest, "desktop-chromium-relay.json") : null;
  const desktopActions = latest ? asset(latest, "desktop-chromium-actions.jsonl") : null;
  const mobileRelay = latest ? asset(latest, "mobile-390-relay.json") : null;
  const mobileActions = latest ? asset(latest, "mobile-390-actions.jsonl") : null;

  return (
    <PageShell
      title="QA Observatory"
      description="Watch this ChatGPT conversation pilot Khonsera screen by screen through a persistent production browser relay."
    >
      <section className="j-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <Activity size={18} aria-hidden="true" style={{ color: state.tone }} />
              <span className="tiny uppercase tracking-[0.14em]">Cloud traveller</span>
            </div>
            <h2 className="h2" style={{ color: state.tone }}>
              {state.label}
            </h2>
            <p className="small mt-1">{state.detail}</p>
            {latestWorkflowRun ? (
              <p className="tiny mt-2 flex items-center gap-1.5">
                <Clock3 size={13} aria-hidden="true" />
                Started {dateLabel(latestWorkflowRun.created_at)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {latestWorkflowRun ? (
              <a
                href={latestWorkflowRun.html_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost"
              >
                Current run
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
            <a
              href={WORKFLOW_URL}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
            >
              Start a traveller run
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </div>
        </div>

        <div
          className="mt-5 rounded-xl px-4 py-3"
          style={{ background: "var(--paper-2)" }}
        >
          <p className="small">
            The active ChatGPT conversation is the traveller brain. A long-lived
            Playwright runner only executes mechanical mouse/keyboard commands,
            republishes the current screen and records evidence. No model API runs
            inside GitHub Actions and QA-created data is preserved between runs.
          </p>
        </div>
      </section>

      {latestWorkflowRun?.status !== "completed" ? (
        <section className="j-card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 p-4">
            <div>
              <p className="tiny uppercase tracking-[0.14em]">Live relay</p>
              <h2 className="h3 mt-1">
                {liveRelay
                  ? `${liveRelay.viewportName === "mobile-390" ? "Mobile" : "Desktop"} · ${liveRelay.status}`
                  : "Browser starting…"}
              </h2>
              <p className="small mt-1">
                {liveRelay?.url ?? "Waiting for the relay to publish its first screen."}
              </p>
            </div>
            {liveRelay ? (
              <span className="tiny">
                Command {liveRelay.commandCount} / {liveRelay.maxCommands}
              </span>
            ) : null}
          </div>
          {liveRelay ? (
            <div className="bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${liveRelay.liveScreenshot}?t=${Date.now()}`}
                alt="Current Khonsera QA browser screen"
                className="mx-auto block max-h-[760px] w-full object-contain"
              />
            </div>
          ) : (
            <div className="p-5">
              <p className="small">Authentication and browser startup are still in progress.</p>
            </div>
          )}
        </section>
      ) : null}

      {latest ? (
        <>
          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="tiny uppercase tracking-[0.14em]">Latest evidence</p>
                <h2 className="h2 mt-1">{latest.name ?? "Traveller run"}</h2>
              </div>
              <p className="tiny">{dateLabel(latest.published_at)}</p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Recording
                title="Desktop traveller"
                description="1440 × 1000 Chromium. Watch the click flow, timing and UI response."
                video={desktopVideo}
                trace={desktopTrace}
                relay={desktopRelay}
                actions={desktopActions}
                icon={<Monitor size={19} aria-hidden="true" />}
              />
              <Recording
                title="Mobile traveller"
                description="390 × 844 touch Chromium. The same journey through Khonsera's mobile acceptance viewport."
                video={mobileVideo}
                trace={mobileTrace}
                relay={mobileRelay}
                actions={mobileActions}
                icon={<Smartphone size={19} aria-hidden="true" />}
              />
            </div>

            <p className="small mt-3">
              “Relay result” contains the adaptive traveller's outcome, UX findings
              and what worked. “Action log” records the screen-driven computer actions.
              “Inspect trace” remains the browser-level forensic view for DOM, console,
              network and timing evidence.
            </p>
          </section>

          {observerReleases.length > 1 ? (
            <section className="j-card p-5">
              <h2 className="h3">Recent observer runs</h2>
              <div className="mt-3 divide-y divide-black/10">
                {observerReleases.slice(1).map((release) => (
                  <div
                    key={release.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="small font-medium">
                        {release.name ?? release.tag_name}
                      </p>
                      <p className="tiny mt-0.5">{dateLabel(release.published_at)}</p>
                    </div>
                    <a
                      href={release.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost"
                    >
                      Evidence
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="j-card p-5">
          <h2 className="h3">No recording yet</h2>
          <p className="small mt-2 max-w-2xl">
            Run an authorised QA:UX command or open the cloud runner above and choose
            desktop, mobile or both. You can return to this page while it runs; once
            the observer finishes, refresh and the recording and trace will appear here.
          </p>
        </section>
      )}

      <section className="j-card p-5">
        <h2 className="h3">Chat-piloted QA, with deterministic regression underneath</h2>
        <p className="small mt-2">
          QA:UX is exploratory: this conversation inspects the current screen and
          decides the next traveller action. The relay itself has no product knowledge.
          Deterministic Playwright remains in CI for known regression contracts.
          While a run is active the current screenshot is visible above; full replay
          evidence publishes when the run finishes.
        </p>
        <Link href="/settings" className="small mt-3 inline-block underline">
          Back to Settings
        </Link>
      </section>
    </PageShell>
  );
}
