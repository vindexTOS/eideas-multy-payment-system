import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/ka";
import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { ka } from "./locales/ka";

export const LANGUAGES = ["ka", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = "eideas.language";

/**
 * Georgian is the default: the client and their companies are Georgian, and
 * English is there for anyone who needs it. Detection reads only our own
 * localStorage key - deliberately NOT the browser language, so the panel
 * always opens in Georgian until someone picks otherwise, rather than
 * flipping to English on an en-US machine.
 */
void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ka: { translation: ka },
    },
    fallbackLng: "ka",
    supportedLngs: LANGUAGES,
    // 'ka-GE' should resolve to 'ka'.
    load: "languageOnly",
    nonExplicitSupportedLngs: true,
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

/**
 * dayjs formats the chart month labels and the "x ago" strings, so it has to
 * follow the same switch. Wired here, outside React, so no component has to
 * perform this side effect during render.
 */
const syncDayjs = (language: string) => {
  dayjs.locale(
    (LANGUAGES as readonly string[]).includes(language) ? language : "ka",
  );
};

syncDayjs(i18n.resolvedLanguage ?? "ka");
i18n.on("languageChanged", syncDayjs);

export default i18n;
