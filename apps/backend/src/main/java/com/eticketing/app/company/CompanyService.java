package com.eticketing.app.company;

import com.eticketing.app.web.error.ApiExceptions.ConflictException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

/**
 * Company business-logic layer. Handles CRUD, taxId uniqueness, and active-trip
 * guard on delete.
 */
@Service
@RequiredArgsConstructor
public class CompanyService {

    private final CompanyRepository companyRepository;
    private final MongoTemplate mongoTemplate;

    /* ───── Queries ───── */
    public Page<CompanyType> list(String searchString, CompanyStatus status, int page, int limit) {
        var pageable = PageRequest.of(page, limit);
        boolean hasSearch = searchString != null && !searchString.isBlank();
        boolean hasStatus = status != null;

        if (hasSearch && hasStatus) {
            return companyRepository.findByStatusAndNameLike(status, searchString, pageable);
        }
        if (hasStatus) {
            return companyRepository.findByStatus(status, pageable);
        }
        if (hasSearch) {
            return companyRepository.findByNameLike(searchString, pageable);
        }
        return companyRepository.findAll(pageable);
    }

    public CompanyType getById(String id) {
        return companyRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Company not found: " + id));
    }

    /* ───── Commands ───── */
    public CompanyType create(CompanyType company) {
        if (company.getTaxId() != null && companyRepository.existsByTaxId(company.getTaxId())) {
            throw new ConflictException("COMPANY_TAX_ID_ALREADY_EXISTS");
        }
        return companyRepository.save(company);
    }

    public CompanyType update(String id, CompanyController.CompanyUpdateReq updates) {
        var existing = getById(id);

        if (updates.name() != null) {
            if (updates.name().isBlank()) {
                throw new BadRequestException("name must not be blank");
            }
            existing.setName(updates.name());
        }
        if (updates.legalName() != null) {
            existing.setLegalName(updates.legalName());
        }
        if (updates.taxId() != null) {
            // Check uniqueness only if taxId is changing
            if (!updates.taxId().equals(existing.getTaxId())
                    && companyRepository.existsByTaxId(updates.taxId())) {
                throw new ConflictException("COMPANY_TAX_ID_ALREADY_EXISTS");
            }
            existing.setTaxId(updates.taxId());
        }
        if (updates.platformFeePercentage() != null) {
            existing.setPlatformFeePercentage(updates.platformFeePercentage());
        }
        if (updates.currencyId() != null) {
            existing.setCurrencyId(updates.currencyId());
        }
        if (updates.emailTemplate() != null) {
            existing.setEmailTemplate(updates.emailTemplate());
        }
        if (updates.picture() != null) {
            existing.setPicture(mergePicture(existing.getPicture(), updates.picture()));
        }
        if (updates.bankAccount() != null) {
            existing.setBankAccount(mergeBankAccount(existing.getBankAccount(), updates.bankAccount()));
        }
        if (updates.contact() != null) {
            existing.setContact(mergeContact(existing.getContact(), updates.contact()));
        }

        return companyRepository.save(existing);
    }

    public CompanyType updateStatus(String id, CompanyStatus newStatus) {
        var existing = getById(id);
        existing.setStatus(newStatus);
        return companyRepository.save(existing);
    }

    public void delete(String id) {
        if (!companyRepository.existsById(id)) {
            throw new NotFoundException("Company not found: " + id);
        }
        assertNoActivePOS(id);
        companyRepository.deleteById(id);
    }

    /* ───── Guards ───── */
    /**
     * Prevent deletion if the company still has POS attached.
     */
    private void assertNoActivePOS(String companyId) {
        var query = new Query(Criteria.where("companyId").is(companyId));
        if (mongoTemplate.exists(query, "pointofsales")) {
            throw new ConflictException("COMPANY_HAS_ACTIVE_POS");
        }
    }

    /* ───── Merge helpers ───── */
    private com.eticketing.app.common.PictureType mergePicture(
            com.eticketing.app.common.PictureType existing,
            CompanyController.PictureReq req) {
        if (existing == null) {
            existing = new com.eticketing.app.common.PictureType();
        }
        if (req.baseUrl() != null) {
            existing.setBaseUrl(req.baseUrl());
        }
        if (req.path() != null) {
            existing.setPath(req.path());
        }
        return existing;
    }

    private BankAccountType mergeBankAccount(BankAccountType existing, CompanyController.BankAccountReq req) {
        if (existing == null) {
            existing = new BankAccountType();
        }
        if (req.iban() != null) {
            existing.setIban(req.iban());
        }
        if (req.bankName() != null) {
            existing.setBankName(req.bankName());
        }
        if (req.accountHolder() != null) {
            existing.setAccountHolder(req.accountHolder());
        }
        return existing;
    }

    private ContactType mergeContact(ContactType existing, CompanyController.ContactReq req) {
        if (existing == null) {
            existing = new ContactType();
        }
        if (req.email() != null) {
            existing.setEmail(req.email());
        }
        if (req.phone() != null) {
            var phone = existing.getPhone();
            if (phone == null) {
                phone = new com.eticketing.app.user.PhoneType();
            }
            if (req.phone().countryCode() != null) {
                phone.setCountryCode(req.phone().countryCode());
            }
            if (req.phone().number() != null) {
                phone.setNumber(req.phone().number());
            }
            existing.setPhone(phone);
        }
        return existing;
    }
}
