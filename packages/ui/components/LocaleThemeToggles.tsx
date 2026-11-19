import React from 'react';
import { useTheme } from './ThemeProvider';
import { toggleLocale, useLocale } from '../i18n/locale';

const btn =
  'inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-semibold transition-colors text-muted-foreground hover:text-foreground hover:bg-muted';

/**
 * Header controls: switch the interface between Arabic and English, and
 * between dark and light mode. The theme button flips the resolved mode, so
 * a "Match system" setting becomes an explicit choice once clicked.
 */
export const LocaleThemeToggles: React.FC<{ className?: string; compact?: boolean }> = ({
  className = '',
  compact = false,
}) => {
  const locale = useLocale();
  const { resolvedMode, setMode } = useTheme();
  const isDark = resolvedMode === 'dark';
  const size = compact ? 'h-11 min-w-11' : '';

  return (
    <div className={`flex items-center gap-0.5 ${className}`} data-no-i18n="">
      <button
        type="button"
        onClick={toggleLocale}
        className={`${btn} ${size}`}
        title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        aria-label={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        data-locale-toggle=""
      >
        {locale === 'ar' ? 'EN' : 'ع'}
      </button>
      <button
        type="button"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        className={`${btn} ${size}`}
        title={
          locale === 'ar'
            ? isDark ? 'الوضع الفاتح' : 'الوضع الداكن'
            : isDark ? 'Light mode' : 'Dark mode'
        }
        aria-label={
          locale === 'ar'
            ? isDark ? 'الوضع الفاتح' : 'الوضع الداكن'
            : isDark ? 'Light mode' : 'Dark mode'
        }
        data-theme-toggle=""
      >
        {isDark ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>
    </div>
  );
};
