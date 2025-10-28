import { isEqual } from 'lodash';

/**
 * Returns an object with only the changed fields between current and initial values.
 * Handles nested objects (e.g., phone group).
 */
export function getChangedValues(current: any, initial: any): any {
  const changed: any = Array.isArray(current) ? [] : {};
  Object.keys(current).forEach((key) => {
    if (
      typeof current[key] === 'object' &&
      current[key] !== null &&
      initial[key] !== null
    ) {
      const nested = getChangedValues(current[key], initial[key]);
      if (Object.keys(nested).length > 0) {
        changed[key] = nested;
      }
    } else if (!isEqual(current[key], initial[key])) {
      changed[key] = current[key];
    }
  });
  return changed;
}
