import { useDark, useToggle } from '@vueuse/core';

export const isDark = useDark({
  selector: 'html',
  attribute: 'data-theme',
  valueDark: 'dark',
  valueLight: 'light',
  disableTransition: false, // 確保動畫不被吃掉
});

export const toggleDark = useToggle(isDark);