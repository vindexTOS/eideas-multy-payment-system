import type { Locale } from "antd/es/locale";
import enUS from "antd/locale/en_US";
import kaGE from "antd/locale/ka_GE";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { LANGUAGES, type Language } from "./index";

const ANTD_LOCALES: Record<Language, Locale> = { en: enUS, ka: kaGE };

/**
 * Switching language moves three things at once: our own strings (i18next),
 * Ant Design's built-in component text (pagination, empty states,
 * popconfirms) and dayjs, which formats the chart month labels. dayjs is
 * handled by the `languageChanged` listener in ./index.
 */
export const useLanguage = () => {
  const { i18n } = useTranslation();
  const language = (LANGUAGES as readonly string[]).includes(
    i18n.resolvedLanguage ?? "",
  )
    ? (i18n.resolvedLanguage as Language)
    : "ka";

  const setLanguage = useCallback(
    (next: Language) => {
      void i18n.changeLanguage(next);
    },
    [i18n],
  );

  return {
    language,
    setLanguage,
    antdLocale: ANTD_LOCALES[language],
    languages: LANGUAGES,
  };
};
