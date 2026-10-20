import type { ConceptId } from '../i18n/content/types';
import type { Locale, Method, PretestMode } from '../stats/types';
import type { Tab } from './state';

type Events = {
  method_changed: { method: Method };
  pretest_mode_changed: { mode: PretestMode };
  plan_used: { groups: number; sequential: boolean };
  variant_added: { groups: number };
  sequential_toggled: { enabled: boolean };
  tldr_requested: { locale: Locale };
  tldr_result: { result: 'success' | 'fallback' | 'rate_limit' };
  share_link_copied: { tldr: boolean };
  example_data_loaded: { tab: Tab };
  explanation_opened: { concept: ConceptId };
  language_switched: { locale: Locale };
  theme_switched: { theme: 'light' | 'dark' };
};
declare global {
  interface Window { umami?: { track: (event: string, data: object) => void } }
}
export function track<K extends keyof Events>(event: K, data: Events[K]): void {
  window.umami?.track(event, data);
}
