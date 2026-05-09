package com.eticketing.app.trip;

import com.eticketing.app.bus.BusRepository;
import com.eticketing.app.bus.BusType;
import com.eticketing.app.company.CompanyRepository;
import com.eticketing.app.company.CompanyType;
import com.eticketing.app.currency.CurrencyRepository;
import com.eticketing.app.currency.CurrencyType;
import com.eticketing.app.place.PlaceRepository;
import com.eticketing.app.place.PlaceType;
import com.eticketing.app.trip.dto.TripRouteAvailabilityResponse;
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
        return enrich(trip, null, null);
    }

    public TripResponse enrich(TripType trip, String originPlaceId, String destinationPlaceId) {
        if (trip == null) {
            return null;
        }

        TripType reconciledTrip = tripInventoryReconciliationService.reconcile(List.of(trip)).get(0);
        Set<String> placeIds = new HashSet<>();
        collectPlaceIds(reconciledTrip, placeIds);

        Map<String, PlaceType> placeMap = placeIds.isEmpty()
                ? Map.of()
                : placeRepository.findAllById(placeIds).stream()
                        .collect(Collectors.toMap(PlaceType::getId, Function.identity()));

        Map<String, BusType> busMap = loadBusMap(reconciledTrip);
        Map<String, CompanyType> companyMap = loadCompanyMap(reconciledTrip);
        Map<String, CurrencyType> currencyMap = loadCurrencyMap(reconciledTrip);

        BusType busEntity = reconciledTrip.getBus() != null ? busMap.get(reconciledTrip.getBus().getBusId()) : null;
        CurrencyType currencyEntity = reconciledTrip.getCurrency() != null
                ? currencyMap.get(reconciledTrip.getCurrency().getCurrencyId())
                : null;
        TripResponse.MarketplaceView marketplace = hasText(originPlaceId) && hasText(destinationPlaceId)
                ? TripMarketplaceProjectionFactory.build(
                        reconciledTrip,
                        originPlaceId,
                        destinationPlaceId,
                        busEntity,
                        currencyEntity != null ? currencyEntity.getCode() : "DT",
                        placeMap)
                : null;

        return TripResponse.from(reconciledTrip, placeMap, busMap, currencyMap, companyMap, marketplace);
    }

    public List<TripResponse> enrich(List<TripType> trips) {
        return enrich(trips, null, null);
    }

    public List<TripResponse> enrich(List<TripType> trips, String originPlaceId, String destinationPlaceId) {
        if (trips == null || trips.isEmpty()) {
            return List.of();
        }

        List<TripType> reconciledTrips = tripInventoryReconciliationService.reconcile(trips);
        boolean includeMarketplaceProjection = hasText(originPlaceId) && hasText(destinationPlaceId);

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
                .map(trip -> {
                    BusType busEntity = trip.getBus() != null ? busMap.get(trip.getBus().getBusId()) : null;
                    CurrencyType currencyEntity = trip.getCurrency() != null
                            ? currencyMap.get(trip.getCurrency().getCurrencyId())
                            : null;
                    TripResponse.MarketplaceView marketplace = includeMarketplaceProjection
                            ? TripMarketplaceProjectionFactory.build(
                                    trip,
                                    originPlaceId,
                                    destinationPlaceId,
                                    busEntity,
                                    currencyEntity != null ? currencyEntity.getCode() : "DT",
                                    placeMap)
                            : null;
                    return TripResponse.from(trip, placeMap, busMap, currencyMap, companyMap, marketplace);
                })
                .filter(response -> !includeMarketplaceProjection || response.getMarketplace() != null)
                .toList();
    }

    public TripRouteAvailabilityResponse routeAvailability(
            TripType trip,
            String originPlaceId,
            String destinationPlaceId) {
        if (trip == null) {
            return null;
        }

        TripType reconciledTrip = tripInventoryReconciliationService.reconcile(List.of(trip)).get(0);
        BusType busEntity = reconciledTrip.getBus() != null && reconciledTrip.getBus().getBusId() != null
                ? busRepository.findById(reconciledTrip.getBus().getBusId()).orElse(null)
                : null;
        CurrencyType currencyEntity = reconciledTrip.getCurrency() != null
                ? currencyRepository.findById(reconciledTrip.getCurrency().getCurrencyId()).orElse(null)
                : null;

        return TripMarketplaceProjectionFactory.buildRouteAvailability(
                reconciledTrip,
                originPlaceId,
                destinationPlaceId,
                busEntity,
                currencyEntity != null ? currencyEntity.getCode() : "DT");
    }

    private void collectPlaceIds(TripType trip, Set<String> placeIds) {
        if (trip.getStopSchedule() != null) {
            trip.getStopSchedule().forEach(s -> addIfPresent(placeIds, s.getPlaceId()));
        }
        if (trip.getSegments() != null) {
            trip.getSegments().forEach(s -> {
                addIfPresent(placeIds, TripPlaceRef.idOf(s.getFromPlace()));
                addIfPresent(placeIds, TripPlaceRef.idOf(s.getToPlace()));
            });
        }
        if (trip.getExpressSegments() != null) {
            trip.getExpressSegments().forEach(segment -> {
                addIfPresent(placeIds, TripPlaceRef.idOf(segment.getFromPlace()));
                addIfPresent(placeIds, TripPlaceRef.idOf(segment.getToPlace()));
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

    private Map<String, BusType> loadBusMap(TripType trip) {
        if (trip.getBus() == null || trip.getBus().getBusId() == null || trip.getBus().getBusId().isBlank()) {
            return Map.of();
        }

        return busRepository.findById(trip.getBus().getBusId())
                .map(bus -> Map.of(bus.getId(), bus))
                .orElseGet(Map::of);
    }

    private Map<String, CompanyType> loadCompanyMap(TripType trip) {
        String companyId = trip.getTarget() != null ? trip.getTarget().getCompany() : null;
        if (!hasText(companyId)) {
            return Map.of();
        }

        return companyRepository.findById(companyId)
                .map(company -> Map.of(company.getId(), company))
                .orElseGet(Map::of);
    }

    private Map<String, CurrencyType> loadCurrencyMap(TripType trip) {
        String currencyId = trip.getCurrency() != null ? trip.getCurrency().getCurrencyId() : null;
        if (!hasText(currencyId)) {
            return Map.of();
        }

        return currencyRepository.findById(currencyId)
                .map(currency -> Map.of(currency.getId(), currency))
                .orElseGet(Map::of);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
