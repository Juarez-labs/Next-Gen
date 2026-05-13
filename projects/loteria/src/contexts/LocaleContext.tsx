import React, { createContext, useContext, useMemo, useState } from "react";
import { STRINGS, type Locale, type StringKey } from "../lib/i18n";

type LocaleValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: StringKey) => string;
};

const LocaleContext = createContext<LocaleValue>({
  locale: "es",
  setLocale: () => {},
  t: (k) => STRINGS[k].es,
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("es");
  const value = useMemo<LocaleValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => STRINGS[key][locale],
    }),
    [locale]
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
