import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'duration',
  standalone: true,
})
export class DurationPipe implements PipeTransform {
  transform(minutes?: number | null): string {
    if (minutes == null || isNaN(Number(minutes))) return '';
    const m = Math.max(0, Math.floor(Number(minutes)));
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins} min`;
    if (hours > 0) return `${hours}h`;
    return `${mins} min`;
  }
}
