import { type ReportSummary, computePatchCoverage, summarize } from "@covallaby/core";
import { useEffect, useMemo, useState } from "react";
import { loadPayload } from "./data.js";
import { Diff } from "./views/Diff.js";
import { FileDetail } from "./views/FileDetail.js";
import { Missing } from "./views/Missing.js";
import { Overview } from "./views/Overview.js";

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("covallaby-theme", next ? "dark" : "light");
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg border border-(--border) px-3 py-1.5 text-sm text-(--ink-secondary) hover:text-(--ink)"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? "Light" : "Dark"}
    </button>
  );
}

function NavLink({ to, current, children }: { to: string; current: string; children: string }) {
  const active = current === to || (to === "#/" && current === "");
  return (
    <a
      href={to}
      className={
        active
          ? "rounded-lg bg-(--hairline) px-3 py-1.5 text-sm font-medium"
          : "rounded-lg px-3 py-1.5 text-sm text-(--ink-secondary) hover:text-(--ink)"
      }
    >
      {children}
    </a>
  );
}

export function App() {
  const payload = useMemo(loadPayload, []);
  const summary: ReportSummary = useMemo(() => summarize(payload.report), [payload]);
  const patch = useMemo(
    () => (payload.patch ? computePatchCoverage(payload.report, payload.patch) : null),
    [payload],
  );
  const hash = useHashRoute();

  let view: React.ReactNode;
  if (hash.startsWith("#/file/")) {
    const path = decodeURIComponent(hash.slice("#/file/".length));
    view = (
      <FileDetail
        file={payload.report.files.find((f) => f.path === path)}
        source={payload.sources[path]}
        path={path}
      />
    );
  } else if (hash === "#/missing") {
    view = <Missing report={payload.report} />;
  } else if (hash === "#/diff") {
    view = <Diff patch={patch} />;
  } else {
    view = <Overview report={payload.report} summary={summary} patch={patch} />;
  }

  const generated = new Date(payload.generatedAt);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <a href="#/" className="text-xl font-semibold">
            🦘 Covallaby
          </a>
          <div className="mt-0.5 text-xs text-(--ink-muted)">
            Coverage report · generated {generated.toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            <NavLink to="#/" current={hash}>
              Overview
            </NavLink>
            <NavLink to="#/missing" current={hash}>
              Missing lines
            </NavLink>
            {patch ? (
              <NavLink to="#/diff" current={hash}>
                Diff
              </NavLink>
            ) : null}
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main>{view}</main>
      <footer className="mt-12 border-t border-(--hairline) pt-4 text-xs text-(--ink-muted)">
        Made with Covallaby {payload.version} — beautiful coverage reports for your pull requests.
      </footer>
    </div>
  );
}
