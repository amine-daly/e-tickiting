import { Injectable } from '@angular/core';

import { computeRouteAvailableSeats } from '../helpers/trip-inventory.helper';
import { Picture } from '../models/shared.model';
import {
  MarketplaceCompany,
  ExpressSegmentType,
  getExpressSegmentFromPlaceId,
  getExpressSegmentToPlaceId,
  getSegmentFromPlaceId,
  getSegmentToPlaceId,
  MarketplaceProjection,
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
  expandRoutes(trips: TripType[] | null | undefined): MarketplaceTrip[] {
    const routes = new Map<string, MarketplaceTrip>();

    for (const trip of trips || []) {
      for (const selection of this.buildCandidateSelections(trip)) {
        const mappedTrip = this.mapTrip(trip, selection);
        if (!mappedTrip) {
          continue;
        }

        const existingTrip = routes.get(mappedTrip.key);
        if (!existingTrip || mappedTrip.price < existingTrip.price) {
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
    const precomputedMarketplace = this.resolvePrecomputedMarketplace(
      trip,
      selection,
    );
    if (precomputedMarketplace) {
      return this.buildMarketplaceTrip(trip, precomputedMarketplace);
    }

    if (this.hasExplicitSelection(selection)) {
      return null;
    }

    const resolvedRoute = this.resolveRoute(trip, selection);
    if (!resolvedRoute) {
      return null;
    }

    const { originStop, destinationStop, chain } = resolvedRoute;
    const expressSegment = this.findExactExpressSegment(trip, chain);
    if (!this.isRouteMarketable(chain, expressSegment)) {
      return null;
    }

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
        expressSegment?.totalDurationMinutes ??
        chain.reduce((sum, segment) => sum + (segment.durationMinutes || 0), 0),
    };
    const price =
      expressSegment?.price ??
      chain.reduce((sum, segment) => sum + (segment.basePrice || 0), 0);
    const availableSeats = computeRouteAvailableSeats(trip, chain);

    return this.buildMarketplaceTrip(trip, {
      route,
      schedule,
      price,
      availableSeats,
    });
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

    for (const expressSegment of trip.expressSegments || []) {
      if (!this.isExpressSegmentCurrentlyValid(expressSegment)) {
        continue;
      }

      selections.push({
        originPlaceId: getExpressSegmentFromPlaceId(expressSegment),
        destinationPlaceId: getExpressSegmentToPlaceId(expressSegment),
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
      (segment) => getSegmentFromPlaceId(segment) === originPlaceId,
    );
    if (startIndex < 0) {
      return [];
    }

    const chain: SegmentType[] = [];
    let currentPlaceId = originPlaceId;

    for (const segment of segments.slice(startIndex)) {
      if (getSegmentFromPlaceId(segment) !== currentPlaceId) {
        break;
      }

      chain.push(segment);
      currentPlaceId = getSegmentToPlaceId(segment) || '';

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

  private findExactExpressSegment(
    trip: TripType,
    chain: SegmentType[],
  ): ExpressSegmentType | undefined {
    if (chain.length < 2) {
      return undefined;
    }

    const originPlaceId = getSegmentFromPlaceId(chain[0]);
    const destinationPlaceId = getSegmentToPlaceId(chain[chain.length - 1]);
    const segmentIds = chain.map((segment) => segment.segmentId);

    return (trip.expressSegments || []).find(
      (expressSegment) =>
        this.isExpressSegmentCurrentlyValid(expressSegment) &&
        getExpressSegmentFromPlaceId(expressSegment) === originPlaceId &&
        getExpressSegmentToPlaceId(expressSegment) === destinationPlaceId &&
        this.segmentsCoveredMatchesChain(expressSegment, segmentIds),
    );
  }

  private segmentsCoveredMatchesChain(
    expressSegment: ExpressSegmentType,
    segmentIds: string[],
  ): boolean {
    if (expressSegment.segmentsCovered.length !== segmentIds.length) {
      return false;
    }

    return expressSegment.segmentsCovered.every(
      (segmentId, index) => segmentId === segmentIds[index],
    );
  }

  private isRouteMarketable(
    chain: SegmentType[],
    expressSegment: ExpressSegmentType | undefined,
  ): boolean {
    return chain.length === 1 || !!expressSegment;
  }

  private resolvePrecomputedMarketplace(
    trip: TripType,
    selection: TripRouteSelection,
  ): MarketplaceProjection | null {
    if (!this.hasExplicitSelection(selection) || !trip.marketplace) {
      return null;
    }

    if (
      trip.marketplace.route.origin.placeId !== selection.originPlaceId ||
      trip.marketplace.route.destination.placeId !==
        selection.destinationPlaceId
    ) {
      return null;
    }

    return trip.marketplace;
  }

  private hasExplicitSelection(selection: TripRouteSelection): boolean {
    return !!selection.originPlaceId && !!selection.destinationPlaceId;
  }

  private buildMarketplaceTrip(
    trip: TripType,
    marketplace: MarketplaceProjection,
  ): MarketplaceTrip {
    return {
      key: `${trip.id}:${marketplace.route.origin.placeId}:${marketplace.route.destination.placeId}`,
      tripId: trip.id,
      company: this.resolveCompany(trip),
      bus: trip.bus,
      route: marketplace.route,
      schedule: marketplace.schedule,
      price: marketplace.price,
      availableSeats: marketplace.availableSeats,
      currencyCode: trip.currency?.code || 'DT',
    };
  }

  private isExpressSegmentCurrentlyValid(
    expressSegment: ExpressSegmentType,
  ): boolean {
    const now = new Date();

    return (
      expressSegment.active &&
      (!expressSegment.validFrom ||
        now >= new Date(expressSegment.validFrom)) &&
      (!expressSegment.validUntil || now <= new Date(expressSegment.validUntil))
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
