import { isEqual } from 'lodash';

export class FormHelper {
  static getChangedValues(current: any, initial: any): any {
    if (Array.isArray(current)) {
      return isEqual(current, initial) ? [] : current;
    }

    const changed: any = Array.isArray(current) ? [] : {};
    Object.keys(current).forEach((key) => {
      const currentVal = current[key];
      const initialVal = initial[key];

      if (Array.isArray(currentVal) && Array.isArray(initialVal)) {
        if (!isEqual(currentVal, initialVal)) {
          changed[key] = currentVal;
        }
        return;
      }

      if (
        FormHelper.isPlainObject(currentVal) &&
        FormHelper.isPlainObject(initialVal)
      ) {
        const nested = FormHelper.getChangedValues(currentVal, initialVal);
        if (Object.keys(nested).length > 0) {
          changed[key] = nested;
        }
        return;
      }

      let normalizedCurrent = currentVal;
      let normalizedInitial = initialVal;

      if (normalizedCurrent instanceof Date) {
        normalizedCurrent = normalizedCurrent.toISOString();
      }
      if (normalizedInitial instanceof Date) {
        normalizedInitial = normalizedInitial.toISOString();
      }

      const isDateString = (val: any) =>
        typeof val === 'string' && !isNaN(Date.parse(val));
      if (isDateString(normalizedCurrent) && isDateString(normalizedInitial)) {
        normalizedCurrent = new Date(normalizedCurrent).toISOString();
        normalizedInitial = new Date(normalizedInitial).toISOString();
      }

      if (!isEqual(normalizedCurrent, normalizedInitial)) {
        changed[key] = currentVal;
      }
    });
    return changed;
  }

  private static isPlainObject(value: any): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    );
  }
}
