import type { Locale } from "../stats/types";
import type { Tab } from "../app/state";

export type Page = Tab | "about";
export const routes: Record<Locale, Record<Page, string>> = {
  pt: { analysis: "/pt/analise", pretest: "/pt/pre-teste", about: "/pt/sobre" },
  en: { analysis: "/en/analysis", pretest: "/en/pre-test", about: "/en/about" },
};
export const otherLocale = (locale: Locale): Locale =>
  locale === "pt" ? "en" : "pt";
export function counterpart(path: string, locale: Locale): string {
  const page = (Object.keys(routes.pt) as Page[]).find((key) =>
    Object.values(routes).some((map) => map[key] === path),
  );
  return routes[locale][page ?? "analysis"];
}
