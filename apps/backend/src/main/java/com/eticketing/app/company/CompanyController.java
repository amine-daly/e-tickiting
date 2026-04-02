package com.eticketing.app.company;

import com.eticketing.app.common.PictureType;
import com.eticketing.app.user.PhoneType;
import com.eticketing.app.web.PaginateResponseType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * REST controller for Company (transport operator) management.
 */
@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
@Tag(name = "Companies", description = "Transport operator management")
public class CompanyController {

    private final CompanyService companyService;

    /* ═══════ Request DTOs ═══════ */
    public record PictureReq(String baseUrl, String path) {

    }

    public record PhoneReq(String countryCode, String number) {

    }

    public record BankAccountReq(String iban, String bankName, String accountHolder) {

    }

    public record ContactReq(String email, PhoneReq phone) {

    }

    public record CompanyCreateReq(
            @NotBlank String name,
            String legalName,
            String taxId,
            BigDecimal platformFeePercentage,
            String currencyId,
            String emailTemplate,
            PictureReq picture,
            BankAccountReq bankAccount,
            ContactReq contact
            ) {

    }

    public record CompanyUpdateReq(
            String name,
            String legalName,
            String taxId,
            BigDecimal platformFeePercentage,
            String currencyId,
            String emailTemplate,
            PictureReq picture,
            BankAccountReq bankAccount,
            ContactReq contact
            ) {

    }

    public record StatusReq(@NotBlank String status) {

    }

    /* ═══════ Response DTOs ═══════ */
    public record PictureRes(String baseUrl, String path) {

        static PictureRes from(PictureType p) {
            return p == null ? null : new PictureRes(p.getBaseUrl(), p.getPath());
        }
    }

    public record PhoneRes(String countryCode, String number) {

        static PhoneRes from(PhoneType p) {
            return p == null ? null : new PhoneRes(p.getCountryCode(), p.getNumber());
        }
    }

    public record BankAccountRes(String iban, String bankName, String accountHolder) {

        static BankAccountRes from(BankAccountType b) {
            return b == null ? null : new BankAccountRes(b.getIban(), b.getBankName(), b.getAccountHolder());
        }
    }

    public record ContactRes(String email, PhoneRes phone) {

        static ContactRes from(ContactType c) {
            return c == null ? null : new ContactRes(c.getEmail(), PhoneRes.from(c.getPhone()));
        }
    }

    public record CompanyRes(
            String id,
            String name,
            String legalName,
            String taxId,
            CompanyStatus status,
            BigDecimal platformFeePercentage,
            String currencyId,
            String emailTemplate,
            PictureRes picture,
            BankAccountRes bankAccount,
            ContactRes contact,
            Instant createdAt,
            Instant updatedAt
            ) {

        static CompanyRes from(CompanyType c) {
            return new CompanyRes(
                    c.getId(),
                    c.getName(),
                    c.getLegalName(),
                    c.getTaxId(),
                    c.getStatus(),
                    c.getPlatformFeePercentage(),
                    c.getCurrencyId(),
                    c.getEmailTemplate(),
                    PictureRes.from(c.getPicture()),
                    BankAccountRes.from(c.getBankAccount()),
                    ContactRes.from(c.getContact()),
                    c.getCreatedAt(),
                    c.getUpdatedAt()
            );
        }
    }

    /* ═══════ Endpoints ═══════ */
    @GetMapping
    @Operation(summary = "List companies (paginated, optional search & status filter)")
    public PaginateResponseType<CompanyRes> list(
            @RequestParam(defaultValue = "") String searchString,
            @RequestParam(required = false) CompanyStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit) {

        var result = companyService.list(searchString, status, page, limit);
        var items = result.getContent().stream().map(CompanyRes::from).toList();
        return new PaginateResponseType<>(items, result.getTotalElements(), result.isLast());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get company by ID")
    public CompanyRes getById(@PathVariable String id) {
        return CompanyRes.from(companyService.getById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a new company")
    public CompanyRes create(@Valid @RequestBody CompanyCreateReq req) {
        return CompanyRes.from(companyService.create(toEntity(req)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a company (partial update)")
    public CompanyRes update(@PathVariable String id, @RequestBody CompanyUpdateReq req) {
        return CompanyRes.from(companyService.update(id, req));
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Update company status (ACTIVE / SUSPENDED)")
    public CompanyRes updateStatus(@PathVariable String id, @Valid @RequestBody StatusReq req) {
        CompanyStatus newStatus = CompanyStatus.valueOf(req.status().toUpperCase());
        return CompanyRes.from(companyService.updateStatus(id, newStatus));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a company (fails if POS still attached)")
    public void delete(@PathVariable String id) {
        companyService.delete(id);
    }

    /* ═══════ Mapping helpers ═══════ */
    private CompanyType toEntity(CompanyCreateReq req) {
        var builder = CompanyType.builder()
                .name(req.name())
                .legalName(req.legalName())
                .taxId(req.taxId())
                .currencyId(req.currencyId())
                .emailTemplate(req.emailTemplate());

        if (req.platformFeePercentage() != null) {
            builder.platformFeePercentage(req.platformFeePercentage());
        }
        if (req.picture() != null) {
            builder.picture(new PictureType(req.picture().baseUrl(), req.picture().path()));
        }
        if (req.bankAccount() != null) {
            builder.bankAccount(BankAccountType.builder()
                    .iban(req.bankAccount().iban())
                    .bankName(req.bankAccount().bankName())
                    .accountHolder(req.bankAccount().accountHolder())
                    .build());
        }
        if (req.contact() != null) {
            var contactBuilder = ContactType.builder().email(req.contact().email());
            if (req.contact().phone() != null) {
                contactBuilder.phone(new PhoneType(
                        req.contact().phone().countryCode(),
                        req.contact().phone().number()));
            }
            builder.contact(contactBuilder.build());
        }

        return builder.build();
    }
}
