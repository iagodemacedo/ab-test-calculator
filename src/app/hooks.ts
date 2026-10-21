import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import type { Locale } from "../stats/types";
import type { Action, AppState, Tab } from "./state";
import { initialState, reducer } from "./reducer";
import {
  clearDraft,
  decode,
  encode,
  readDraft,
  readDraftTab,
  saveDraft,
} from "./codec";
import { routes } from "../i18n/routes";
import { parseAnalysis, parseGroup, parsePretest } from "./parse";
import type { EngineRequest, EngineResponse } from "./engine-protocol";

export function useCalculatorState(
  locale: Locale,
  tab: Tab,
  restoreTab: (tab: Tab) => void,
) {
  const [state, setState] = useState(() => initialState(locale));
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const dirty = useRef(false);
  const lastTab = useRef(tab);
  const revision = useRef(0);
  const dispatch = useCallback(
    (action: Action) => {
      revision.current++;
      dirty.current = action.type !== "clear";
      if (action.type === "clear") {
        try {
          clearDraft(localStorage);
        } catch {}
        history.replaceState(null, "", location.pathname);
        setNotice("");
      }
      setState((previous) => reducer(previous, action, locale));
    },
    [locale],
  );
  useEffect(() => {
    let active = true;
    void (async () => {
      let draft: AppState | null = null;
      let draftTab: Tab | null = null;
      try {
        draft = readDraft(localStorage, locale);
        draftTab = readDraftTab(localStorage);
      } catch {}
      if (location.hash) {
        const shared = await decode(location.hash, locale);
        if (!active) return;
        setState(shared ?? initialState(locale));
        if (!shared) setNotice("invalidLink");
        else {
          if (draft) setNotice("replacedDraft");
          dirty.current = true;
        }
      } else if (draft) {
        setState(draft);
        if (draftTab && draftTab !== tab) {
          history.replaceState(null, "", routes[locale][draftTab]);
          restoreTab(draftTab);
        }
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [locale]);
  useEffect(() => {
    if (!ready) return;
    if (lastTab.current !== tab) {
      dirty.current = true;
      lastTab.current = tab;
    }
    if (!dirty.current) return;
    const at = revision.current;
    const timer = setTimeout(() => {
      try {
        saveDraft(localStorage, state, locale, tab);
      } catch {}
      void encode(
        state,
        locale,
        location.origin.length + location.pathname.length,
      ).then((link) => {
        if (revision.current === at)
          history.replaceState(null, "", location.pathname + link.fragment);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [state, ready, locale, tab]);
  return { state, dispatch, ready, notice, setNotice };
}
export function useEngine(state: AppState, locale: Locale, ready: boolean) {
  const groups = useMemo(
    () =>
      state.analysis.groups.flatMap((group) => {
        const parsed = parseGroup(group, locale);
        return parsed.kind === "ok" ? [parsed.input] : [];
      }),
    [state.analysis.groups, locale],
  );
  const analysis = useMemo(
    () => parseAnalysis(state.analysis, state.currency, state.plan, locale),
    [state.analysis, state.currency, state.plan, locale],
  );
  const pretest = useMemo(
    () => parsePretest(state.pretest, locale),
    [state.pretest, locale],
  );
  const [response, setResponse] = useState<EngineResponse | null>(null);
  const [computedState, setComputedState] = useState<AppState | null>(null);
  const pendingState = useRef(state);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const worker = useRef<Worker | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    const instance = new Worker(
      new URL("./engine.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<EngineResponse>) => {
      if (event.data.id !== requestId.current) return;
      setResponse(event.data);
      setComputedState(pendingState.current);
      setBusy(false);
      setError(false);
    };
    instance.onerror = () => {
      setError(true);
      setBusy(false);
    };
    return () => {
      instance.terminate();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready || !worker.current) return;
    const id = ++requestId.current;
    setBusy(true);
    setError(false);
    const request: EngineRequest = {
      id,
      analysis: analysis.kind === "ok" ? analysis.input : null,
      groups,
      incompleteGroups: state.analysis.groups.filter(
        (group) => !groups.some((complete) => complete.id === group.id),
      ),
      pretest: pretest.kind === "ok" ? pretest.input : null,
      selectedWeek: state.pretest.selectedWeek,
      settings: state.settings,
    };
    pendingState.current = state;
    worker.current.postMessage(request);
  }, [
    analysis,
    pretest,
    groups,
    state.settings,
    state.pretest.selectedWeek,
    ready,
  ]);
  const pending =
    busy ||
    !computedState ||
    computedState.analysis !== state.analysis ||
    computedState.pretest !== state.pretest ||
    computedState.settings !== state.settings ||
    computedState.currency !== state.currency ||
    computedState.plan !== state.plan;
  return { analysis, pretest, response, computedState, busy: pending, error };
}
