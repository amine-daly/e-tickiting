package com.eticketing.app.agency;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;
import java.util.Map;

@RestController
@RequestMapping("/api/agencies")
public class AgencyController {
    private final AgencyRepository agencyRepository;

    @Autowired
    public AgencyController(AgencyRepository agencyRepository) {
        this.agencyRepository = agencyRepository;
    }

    @PostMapping
    public ResponseEntity<Agency> createAgency(@RequestBody Agency agency) {
        Agency saved = agencyRepository.save(agency);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<Agency>> getAllAgencies() {
        return ResponseEntity.ok(agencyRepository.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Agency> getAgencyById(@PathVariable String id) {
        Optional<Agency> agency = agencyRepository.findById(id);
        return agency.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateAgency(@PathVariable String id, @RequestBody java.util.Map<String, Object> updates) {
        Optional<Agency> agencyOpt = agencyRepository.findById(id);
        if (agencyOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Agency not found");
        }
        Agency agency = agencyOpt.get();
        try {
            if (updates.containsKey("name")) agency.setName((String) updates.get("name"));
            if (updates.containsKey("address")) agency.setAddress((String) updates.get("address"));
            if (updates.containsKey("email")) agency.setEmail((String) updates.get("email"));
            if (updates.containsKey("phone")) {
                Object phoneObj = updates.get("phone");
                if (phoneObj instanceof Map<?, ?> phoneMap) {
                    String countryCode = (String) phoneMap.get("countryCode");
                    String number = (String) phoneMap.get("number");
                    agency.setPhone(new com.eticketing.app.user.PhoneType(countryCode, number));
                } else {
                    return ResponseEntity.badRequest().body("Invalid phone format");
                }
            }
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Invalid input: " + e.getMessage());
        }
        Agency updated = agencyRepository.save(agency);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAgency(@PathVariable String id) {
        if (!agencyRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        agencyRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
