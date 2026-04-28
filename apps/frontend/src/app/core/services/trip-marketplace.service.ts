import { Injectable } from '@angular/core';

import { Picture } from '../models/shared.model';
import {
  MarketplaceCompany,
  MarketplaceCapacity,
  ExpressFareType,
  MarketplacePricing,
  MarketplaceRoute,
  MarketplaceSchedule,
  MarketplaceTrip,
  SegmentType,
  StopType,
  TripRouteSelection,
  TripType,
} from '../models/trip.model';

type ResolvedRoute = {
  originStop: StopType;
  destinationStop: StopType;
  chain: SegmentType[];
};

@Injectable({ providedIn: 'root' })
export class TripMarketplaceService {
  mapSearchResults(
    trips: TripType[] | null | undefined,
    selection: TripRouteSelection,
  ): MarketplaceTrip[] {
    return (trips || [])
      .map((trip) => this.mapTrip(trip, selection))
      .filter((trip): trip is MarketplaceTrip => trip !== null);
  }

  expandRoutes(trips: TripType[] | null | undefined): MarketplaceTrip[] {
    const routes = new Map<string, MarketplaceTrip>();

    for (const trip of trips || []) {
      for (const selection of this.buildCandidateSelections(trip)) {
        const mappedTrip = this.mapTrip(trip, selection);
        if (!mappedTrip) {
          continue;
        }

        const existingTrip = routes.get(mappedTrip.key);
        if (
          !existingTrip ||
          mappedTrip.pricing.displayPrice < existingTrip.pricing.displayPrice
        ) {
          routes.set(mappedTrip.key, mappedTrip);
        }
      }
    }

    return Array.from(routes.values()).sort((left, right) => {
      const leftDate =
        left.schedule.departureTime || left.schedule.departureDate;
      const rightDate =
        right.schedule.departureTime || right.schedule.departureDate;
      return leftDate.localeCompare(rightDate);
    });
  }

  mapTrip(
    trip: TripType,
    selection: TripRouteSelection = {},
  ): MarketplaceTrip | null {
    const resolvedRoute = this.resolveRoute(trip, selection);
    if (!resolvedRoute) {
      return null;
    }

    const { originStop, destinationStop, chain } = resolvedRoute;
    const expressFare = this.findExactExpressFare(
      trip,
      originStop.placeId,
      destinationStop.placeId,
    );
    const company = this.resolveCompany(trip);
    const route: MarketplaceRoute = {
      origin: {
        placeId: originStop.placeId,
        city: this.getCityLabel(originStop),
      },
      destination: {
        placeId: destinationStop.placeId,
        city: this.getCityLabel(destinationStop),
      },
    };
    const schedule: MarketplaceSchedule = {
      departureDate: trip.departureDate,
      travelDate: this.toTravelDate(trip.departureDate),
      departureTime: originStop.departureTime,
      arrivalTime: destinationStop.arrivalTime,
      durationMinutes:
        expressFare?.totalDurationMinutes ??
        chain.reduce((sum, segment) => sum + (segment.durationMinutes || 0), 0),
    };
    const pricing: MarketplacePricing = {
      displayPrice:
        expressFare?.price ??
        chain.reduce((sum, segment) => sum + (segment.basePrice || 0), 0),
      currencyCode: trip.currency?.code || 'DT',
    };
    const capacity: MarketplaceCapacity = {
      availableSeats: this.computeAvailableSeats(chain),
    };

    return {
      key: `${trip.id}:${originStop.placeId}:${destinationStop.placeId}`,
      tripId: trip.id,
      company,
      bus: trip.bus,
      route,
      schedule,
      pricing,
      capacity,
    };
  }

  private buildCandidateSelections(trip: TripType): TripRouteSelection[] {
    const stops = this.getSortedStops(trip);
    const firstBoardingStop = stops.find((stop) => stop.boardingAllowed);
    const lastDroppingStop = [...stops]
      .reverse()
      .find((stop) => stop.droppingAllowed);
    const selections: TripRouteSelection[] = [];

    if (
      firstBoardingStop &&
      lastDroppingStop &&
      firstBoardingStop.sequence < lastDroppingStop.sequence
    ) {
      selections.push({
        originPlaceId: firstBoardingStop.placeId,
        destinationPlaceId: lastDroppingStop.placeId,
      });
    }

    for (const fare of trip.expressFares || []) {
      if (!fare.active) {
        continue;
      }

      selections.push({
        originPlaceId: fare.fromPlaceId,
        destinationPlaceId: fare.toPlaceId,
      });
    }

    const seen = new Set<string>();
    return selections.filter((selection) => {
      const key = `${selection.originPlaceId}:${selection.destinationPlaceId}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  private resolveRoute(
    trip: TripType,
    selection: TripRouteSelection,
  ): ResolvedRoute | null {
    const stops = this.getSortedStops(trip);
    if (!stops.length) {
      return null;
    }

    const defaultOrigin =
      stops.find((stop) => stop.boardingAllowed) || stops[0];
    const defaultDestination =
      [...stops].reverse().find((stop) => stop.droppingAllowed) ||
      stops[stops.length - 1];

    const originStop = selection.originPlaceId
      ? stops.find(
          (stop) =>
            stop.placeId === selection.originPlaceId && stop.boardingAllowed,
        ) || null
      : defaultOrigin;
    const destinationStop = selection.destinationPlaceId
      ? stops.find(
          (stop) =>
            stop.placeId === selection.destinationPlaceId &&
            stop.droppingAllowed,
        ) || null
      : defaultDestination;

    if (
      !originStop ||
      !destinationStop ||
      originStop.sequence >= destinationStop.sequence
    ) {
      return null;
    }

    const chain = this.getSegmentChain(
      trip,
      originStop.placeId,
      destinationStop.placeId,
    );

    if (!chain.length) {
      return null;
    }

    return { originStop, destinationStop, chain };
  }

  private getSegmentChain(
    trip: TripType,
    originPlaceId: string,
    destinationPlaceId: string,
  ): SegmentType[] {
    const segments = this.getSortedSegments(trip);
    if (!segments.length) {
      return [];
    }

    const startIndex = segments.findIndex(
      (segment) => segment.fromPlaceId === originPlaceId,
    );
    if (startIndex < 0) {
      return [];
    }

    const chain: SegmentType[] = [];
    let currentPlaceId = originPlaceId;

    for (const segment of segments.slice(startIndex)) {
      if (segment.fromPlaceId !== currentPlaceId) {
        break;
      }

      chain.push(segment);
      currentPlaceId = segment.toPlaceId;

      if (currentPlaceId === destinationPlaceId) {
        return chain;
      }
    }

    return [];
  }

  private getSortedStops(trip: TripType): StopType[] {
    return [...(trip.stopSchedule || [])].sort(
      (left, right) => left.sequence - right.sequence,
    );
  }

  private getSortedSegments(trip: TripType): SegmentType[] {
    return [...(trip.segments || [])].sort(
      (left, right) => left.sequence - right.sequence,
    );
  }

  private computeAvailableSeats(segments: SegmentType[]): number {
    if (!segments.length) {
      return 0;
    }

    return Math.max(
      Math.min(
        ...segments.map((segment) => segment.maxSeats - segment.bookedSeats),
      ),
      0,
    );
  }

  private findExactExpressFare(
    trip: TripType,
    originPlaceId: string,
    destinationPlaceId: string,
  ): ExpressFareType | undefined {
    return (trip.expressFares || []).find(
      (fare) =>
        fare.active &&
        fare.fromPlaceId === originPlaceId &&
        fare.toPlaceId === destinationPlaceId,
    );
  }

  private getCityLabel(stop: StopType): string {
    return stop.place?.city || stop.placeId;
  }

  private resolveCompany(trip: TripType): MarketplaceCompany {
    const targetCompany =
      trip.target && typeof trip.target.company === 'object'
        ? trip.target.company
        : null;
    const companyId =
      trip.company?.id ||
      (typeof trip.target?.company === 'string' ? trip.target.company : null) ||
      targetCompany?.id ||
      null;
    const companyName = trip.company?.name || targetCompany?.name || null;
    const picture = trip.company?.picture || targetCompany?.picture || null;

    return {
      id: companyId,
      name: companyName,
      pictureUrl: this.toPictureUrl(picture),
    };
  }

  private toPictureUrl(picture: Picture | null | undefined): string | null {
    if (!picture?.baseUrl && !picture?.path) {
      return null;
    }

    if (picture?.baseUrl && picture?.path) {
      const baseUrl = picture.baseUrl.replace(/\/$/, '');
      const path = picture.path.replace(/^\//, '');
      return `${baseUrl}/${path}`;
    }

    return picture?.path || picture?.baseUrl || null;
  }

  private toTravelDate(value: string | null | undefined): string | null {
    return value ? value.slice(0, 10) : null;
  }
}
