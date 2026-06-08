import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

import { FrontofficeBookingDraft } from '../models/booking.model';
import { FrontofficeBookingDraftService } from '../services/frontoffice-booking-draft.service';

const hasTripContext = (
  tripId: string,
  originPlaceId: string,
  destinationPlaceId: string,
): boolean => !!tripId && !!originPlaceId && !!destinationPlaceId;

const buildSeatSelectQueryParams = (draft: FrontofficeBookingDraft) => ({
  tripId: draft.tripId,
  originPlaceId: draft.originPlaceId,
  destinationPlaceId: draft.destinationPlaceId,
  ...(draft.pickupPointId ? { pickupPointId: draft.pickupPointId } : {}),
  ...(draft.dropoffPointId ? { dropoffPointId: draft.dropoffPointId } : {}),
});

export const seatSelectGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
) => {
  const router = inject(Router);
  const draftService = inject(FrontofficeBookingDraftService);

  const tripId = route.queryParamMap.get('tripId') || '';
  const originPlaceId = route.queryParamMap.get('originPlaceId') || '';
  const destinationPlaceId =
    route.queryParamMap.get('destinationPlaceId') || '';

  if (hasTripContext(tripId, originPlaceId, destinationPlaceId)) {
    return true;
  }

  const draft = draftService.getDraft();
  if (
    draft &&
    hasTripContext(draft.tripId, draft.originPlaceId, draft.destinationPlaceId)
  ) {
    return router.createUrlTree(['/seat-select'], {
      queryParams: buildSeatSelectQueryParams(draft),
    });
  }

  return router.createUrlTree(['/']);
};

export const verificationGuard: CanActivateFn = () => {
  const router = inject(Router);
  const draftService = inject(FrontofficeBookingDraftService);
  const draft = draftService.getDraft();

  if (
    !draft ||
    !hasTripContext(draft.tripId, draft.originPlaceId, draft.destinationPlaceId)
  ) {
    return router.createUrlTree(['/']);
  }

  const hasPassengerCount = draft.passengerCount > 0;
  const selectedSeats = Array.isArray(draft.selectedSeatNos)
    ? draft.selectedSeatNos
    : [];
  const hasSeatSelection =
    !!draft.holdToken || selectedSeats.length >= draft.passengerCount;

  if (!hasPassengerCount || !hasSeatSelection) {
    return router.createUrlTree(['/seat-select'], {
      queryParams: buildSeatSelectQueryParams(draft),
    });
  }

  return true;
};
