package com.eticketing.app.trip;

import com.eticketing.app.bus.BusRepository;
import com.eticketing.app.bus.BusType;
import com.eticketing.app.company.CompanyRepository;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.dto.TripResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Batch-loads referenced Place, Bus, and Currency documents and enriches
 * TripResponse DTOs with display names.
 */
@Component
@RequiredArgsConstructor
public class TripResponseEnricher {

    private final PlaceRepository placeRepository;
    private final BusRepository busRepository;
    private final CompanyRepository companyRepository;
    private final CurrencyRepository currencyRepository;
    private final TripInventoryReconciliationService tripInventoryReconciliationService;

    public TripResponse enrich(TripType trip) {
        return enrich(List.of(trip)).get(0);
    }

    public List<TripResponse> enrich(List<TripType> trips) {
        if (trips == null || trips.isEmpty()) {
            return List.of();
        }

        List<TripType> reconciledTrips = tripInventoryReconciliationService.reconcile(trips);

        // Collect all referenced IDs across all trips
        Set<String> placeIds = new HashSet<>();
        Set<String> busIds = new HashSet<>();
        Set<String> companyIds = new HashSet<>();
        Set<String> currencyIds = new HashSet<>();

        for (TripType trip : reconciledTrips) {
            if (trip.getBus() != null && trip.getBus().getBusId() != null) {
                busIds.add(trip.getBus().getBusId());
            }
            if (trip.getTarget() != null && trip.getTarget().getCompany() != null) {
                companyIds.add(trip.getTarget().getCompany());
            }
            if (trip.getCurrency() != null && trip.getCurrency().getCurrencyId() != null) {
                currencyIds.add(trip.getCurrency().getCurrencyId());
            }
            collectPlaceIds(trip, placeIds);
        }

        // Batch-load all referenced entities
        Map<String, PlaceType> placeMap = placeIds.isEmpty()
                ? Map.of()
                : placeRepository.findAllById(placeIds).stream()
                        .collect(Collectors.toMap(PlaceType::getId, Function.identity()));

        Map<String, BusType> busMap = busIds.isEmpty()
                ? Map.of()
                : busRepository.findAllById(busIds).stream()
                        .collect(Collectors.toMap(BusType::getId, Function.identity()));

        Map<String, CompanyType> companyMap = companyIds.isEmpty()
            ? Map.of()
            : companyRepository.findAllById(companyIds).stream()
                .collect(Collectors.toMap(CompanyType::getId, Function.identity()));

        Map<String, CurrencyType> currencyMap = currencyIds.isEmpty()
                ? Map.of()
                : currencyRepository.findAllById(currencyIds).stream()
                        .collect(Collectors.toMap(CurrencyType::getId, Function.identity()));

        // Map each trip to an enriched response
        return reconciledTrips.stream()
            .map(trip -> TripResponse.from(trip, placeMap, busMap, currencyMap, companyMap))
                .toList();
    }

    private void collectPlaceIds(TripType trip, Set<String> placeIds) {
        if (trip.getStopSchedule() != null) {
            trip.getStopSchedule().forEach(s -> addIfPresent(placeIds, s.getPlaceId()));
        }
        if (trip.getSegments() != null) {
            trip.getSegments().forEach(s -> {
                addIfPresent(placeIds, s.getFromPlaceId());
                addIfPresent(placeIds, s.getToPlaceId());
            });
        }
        if (trip.getExpressFares() != null) {
            trip.getExpressFares().forEach(f -> {
                addIfPresent(placeIds, f.getFromPlaceId());
                addIfPresent(placeIds, f.getToPlaceId());
            });
        }
        if (trip.getPickupPoints() != null) {
            trip.getPickupPoints().forEach(p -> addIfPresent(placeIds, p.getPlaceId()));
        }
        if (trip.getDropoffPoints() != null) {
            trip.getDropoffPoints().forEach(d -> addIfPresent(placeIds, d.getPlaceId()));
        }
    }

    private void addIfPresent(Set<String> set, String value) {
        if (value != null && !value.isBlank()) {
            set.add(value);
        }
    }
}
