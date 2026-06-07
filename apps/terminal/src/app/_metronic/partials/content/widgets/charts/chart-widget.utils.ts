import { getCSSVariableValue } from '../../../../kt/_utils';

const CSS_COLOR_FALLBACKS: Record<string, string> = {
  '--bs-primary': '#0d6efd',
  '--bs-success': '#198754',
  '--bs-info': '#0dcaf0',
  '--bs-warning': '#ffc107',
  '--bs-gray-200': '#e9ecef',
  '--bs-gray-300': '#dee2e6',
  '--bs-gray-500': '#adb5bd',
  '--bs-primary-light': '#e1e9ff',
  '--bs-success-light': '#d1e7dd',
  '--bs-info-light': '#cff4fc',
  '--bs-warning-light': '#fff3cd',
  '--bs-light-primary': '#e1e9ff',
  '--bs-light-success': '#d1e7dd',
  '--bs-light-warning': '#fff3cd',
};

export function getChartCssColor(variableName: string): string {
  const value = getCSSVariableValue(variableName);
  if (value) {
    return value;
  }

  return CSS_COLOR_FALLBACKS[variableName] ?? '#6c757d';
}

export function deferChartRender(init: () => void): void {
  setTimeout(() => init(), 0);
}
