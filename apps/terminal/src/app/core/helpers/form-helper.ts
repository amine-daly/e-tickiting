import { isEqual } from 'lodash';

export class FormHelper {
  static getChangedValues(current: any, initial: any): any {
    const changed: any = Array.isArray(current) ? [] : {};
    Object.keys(current).forEach((key) => {
      const currentVal = current[key];
      const initialVal = initial[key];

      if (Array.isArray(currentVal) && Array.isArray(initialVal)) {
        const nested = FormHelper.getChangedValues(currentVal, initialVal);
        if (
          Array.isArray(nested)
            ? nested.length > 0
            : Object.keys(nested).length > 0
        ) {
          changed[key] = nested;
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
