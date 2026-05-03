import { SegmentType, TripType } from '../models/trip.model';

export function buildExpressBookedBySegmentId(
  trip: Pick<TripType, 'segments' | 'expressSegments'> | null | undefined,
): Map<string, number> {
  const expressBookedBySegmentId = new Map<string, number>();

  for (const segment of trip?.segments || []) {
    expressBookedBySegmentId.set(segment.segmentId, 0);
  }

  for (const expressSegment of trip?.expressSegments || []) {
    if (
      !expressSegment.segmentsCovered?.length ||
      !expressSegment.bookedCount
    ) {
      continue;
    }

    for (const segmentId of expressSegment.segmentsCovered) {
      if (!expressBookedBySegmentId.has(segmentId)) {
        continue;
      }

      expressBookedBySegmentId.set(
        segmentId,
        (expressBookedBySegmentId.get(segmentId) || 0) +
          expressSegment.bookedCount,
      );
    }
  }

  return expressBookedBySegmentId;
}

export function buildPhysicalOccupancyBySegmentId(
  trip: Pick<TripType, 'segments' | 'expressSegments'> | null | undefined,
): Map<string, number> {
  const expressBookedBySegmentId = buildExpressBookedBySegmentId(trip);
  const physicalOccupancyBySegmentId = new Map<string, number>();

  for (const segment of trip?.segments || []) {
    physicalOccupancyBySegmentId.set(
      segment.segmentId,
      (segment.bookedCount || 0) +
        (expressBookedBySegmentId.get(segment.segmentId) || 0),
    );
  }

  return physicalOccupancyBySegmentId;
}

export function computeTripMaxPhysicalOccupancy(
  trip: Pick<TripType, 'segments' | 'expressSegments'> | null | undefined,
): number {
  const occupancies = Array.from(
    buildPhysicalOccupancyBySegmentId(trip).values(),
  );
  return occupancies.length ? Math.max(...occupancies) : 0;
}

export function computeRouteAvailableSeats(
  trip:
    | Pick<TripType, 'bus' | 'segments' | 'expressSegments'>
    | null
    | undefined,
  segments: SegmentType[] | null | undefined,
): number {
  if (!trip?.bus?.totalSeats || !segments?.length) {
    return 0;
  }

  const expressBookedBySegmentId = buildExpressBookedBySegmentId(trip);
  const perSegmentAvailability = segments.map((segment) => {
    const localBookedCount = segment.bookedCount || 0;
    const expressBookedCount =
      expressBookedBySegmentId.get(segment.segmentId) || 0;
    const physicalRemaining =
      trip.bus.totalSeats - localBookedCount - expressBookedCount;

    return Math.max(0, physicalRemaining);
  });

  return perSegmentAvailability.length
    ? Math.max(0, Math.min(...perSegmentAvailability))
    : 0;
}
