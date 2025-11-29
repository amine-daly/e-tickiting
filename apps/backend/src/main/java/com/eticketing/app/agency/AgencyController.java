package com.eticketing.app.agency;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import jakarta.validation.Valid;

import com.eticketing.app.ticket.TicketTemplateDefaults;

@RestController
@RequestMapping("/api/agencies")
public class AgencyController {

    private final AgencyRepository agencyRepository;

    @Autowired
    public AgencyController(AgencyRepository agencyRepository) {
        this.agencyRepository = agencyRepository;
    }

    @PostMapping
    public ResponseEntity<AgencyType> createAgency(@Valid @RequestBody AgencyType agency) {
        if (agency.getTemplate() == null || agency.getTemplate().isBlank()) {
            agency.setTemplate(TicketTemplateDefaults.defaultTemplate());
        }
        AgencyType saved = agencyRepository.save(agency);
        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public ResponseEntity<List<AgencyType>> getAllAgencies() {
        return ResponseEntity.ok(agencyRepository.findAll());
    }

    @GetMapping("/default-template")
    public ResponseEntity<Map<String, String>> getDefaultTemplate() {
        return ResponseEntity.ok(Map.of("template", TicketTemplateDefaults.defaultTemplate()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AgencyType> getAgencyById(@PathVariable String id) {
        Optional<AgencyType> agency = agencyRepository.findById(id);
        return agency.map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    public ResponseEntity<?> updateAgency(@PathVariable String id, @RequestBody java.util.Map<String, Object> updates) {
        Optional<AgencyType> agencyOpt = agencyRepository.findById(id);
        if (agencyOpt.isEmpty()) {
            return ResponseEntity.status(404).body("Agency not found");
        }
        AgencyType agency = agencyOpt.get();
        try {
            if (updates.containsKey("name")) {
                agency.setName((String) updates.get("name"));
            }
            if (updates.containsKey("address")) {
                agency.setAddress((String) updates.get("address"));
            }
            if (updates.containsKey("email")) {
                agency.setEmail((String) updates.get("email"));
            }
            if (updates.containsKey("template")) {
                Object value = updates.get("template");
                if (value == null || value.toString().isBlank()) {
                    agency.setTemplate(TicketTemplateDefaults.defaultTemplate());
                } else {
                    agency.setTemplate(value.toString());
                }
            }
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
        AgencyType updated = agencyRepository.save(agency);
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
