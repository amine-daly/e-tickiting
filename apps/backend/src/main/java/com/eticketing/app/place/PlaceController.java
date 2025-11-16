package com.eticketing.app.place;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/places")
public class PlaceController {

    private record PlaceReq(String city, LonLatType location) {

    }

    private record PlaceRes(String id, String city, LonLatType location) {

        static PlaceRes from(PlaceDocument d) {
            return new PlaceRes(d.getId(), d.getCity(), d.getLocation());
        }
    }

    private record Paginated<T>(List<T> objects, long count, boolean isLast) {

    }

    private final PlaceRepository repo;

    public PlaceController(PlaceRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public Paginated<PlaceRes> list(@RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int limit) {
        Page<PlaceDocument> p = q == null || q.isBlank()
                ? repo.findAll(PageRequest.of(page, limit))
                : repo.findByCityIgnoreCaseContaining(q, PageRequest.of(page, limit));
        var list = p.getContent().stream().map(PlaceRes::from).toList();
        return new Paginated<>(list, p.getTotalElements(), p.isLast());
    }

    @GetMapping("{id}")
    public PlaceRes get(@PathVariable String id) {
        return repo.findById(id).map(PlaceRes::from).orElseThrow();
    }

    @PostMapping
    public PlaceRes create(@RequestBody PlaceReq req) {
        var saved = repo.save(new PlaceDocument(req.city(), req.location()));
        return PlaceRes.from(saved);
    }

    @PutMapping("{id}")
    public PlaceRes update(@PathVariable String id, @RequestBody PlaceReq req) {
        var doc = repo.findById(id).orElseThrow();
        doc.setCity(req.city());
        doc.setLocation(req.location());
        return PlaceRes.from(repo.save(doc));
    }

    @DeleteMapping("{id}")
    public void delete(@PathVariable String id) {
        repo.deleteById(id);
    }
}
