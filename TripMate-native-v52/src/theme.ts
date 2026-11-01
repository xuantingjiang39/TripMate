import { useColorScheme } from 'react-native';

export const brand = {
  primary: '#2459D3',
  route: '#168568',
  warning: '#A86116',
  error: '#C43B49',
};

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    background: dark ? '#0D1524' : '#F5F7FB',
    surface: dark ? '#172338' : '#FFFFFF',
    raised: dark ? '#1E2C43' : '#EEF2F8',
    text: dark ? '#F4F7FC' : '#14233D',
    muted: dark ? '#A8B5C9' : '#66748A',
    border: dark ? '#2B3B55' : '#DDE4EF',
    primary: dark ? '#7FA6FF' : brand.primary,
    onPrimary: dark ? '#102044' : '#FFFFFF',
    route: dark ? '#54C6A6' : brand.route,
    error: dark ? '#FF9AA5' : brand.error,
    warning: dark ? '#F2B36F' : brand.warning,
    input: dark ? '#101B2D' : '#FFFFFF',
  };
}

export type Palette = ReturnType<typeof usePalette>;
