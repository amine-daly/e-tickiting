package com.eticketing.app.ticket;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.ticket.dto.BookingCustomerInput;
import com.eticketing.app.ticket.dto.FrontofficeCreateHoldRequest;
import com.eticketing.app.user.AppEnum;
import com.eticketing.app.user.PhoneType;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import com.eticketing.app.web.error.ApiExceptions.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.apache.commons.lang3.StringUtils;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingCustomerResolver {

    private final UserTypeRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserType getRequiredUser(String userId) {
        String normalizedUserId = StringUtils.trimToNull(userId);
        if (normalizedUserId == null) {
            throw new BadRequestException("INVALID_PASSENGER_ID: passengerId is required");
        }
        return userRepository.findById(normalizedUserId)
                .orElseThrow(() -> new NotFoundException("User not found: " + normalizedUserId));
    }

    public UserType resolveOrCreateFrontofficeContact(
            FrontofficeCreateHoldRequest.ContactPassenger contact,
            TargetInput requestTarget) {
        if (contact == null) {
            throw new BadRequestException("INVALID_CONTACT: contact is required");
        }

        BookingCustomerInput bookingCustomer = new BookingCustomerInput();
        bookingCustomer.setFirstName(contact.getFirstName());
        bookingCustomer.setLastName(contact.getLastName());
        bookingCustomer.setEmail(contact.getEmail());
        return resolveOrCreateCustomer(bookingCustomer, requestTarget);
    }

    public UserType resolveOrCreatePosContact(BookingCustomerInput contact, TargetInput requestTarget) {
        return resolveOrCreateCustomer(contact, requestTarget);
    }

    public TargetInput normalizeTarget(TargetInput target) {
        if (target == null) {
            return null;
        }

        String company = StringUtils.trimToNull(target.getCompany());
        String pos = StringUtils.trimToNull(target.getPos());
        if (company == null && pos == null) {
            return null;
        }

        TargetInput normalized = new TargetInput();
        normalized.setCompany(company);
        normalized.setPos(pos);
        return normalized;
    }

    public String normalizeTargetCompany(TargetInput target) {
        return target != null ? StringUtils.trimToNull(target.getCompany()) : null;
    }

    public String normalizeTargetPos(TargetInput target) {
        return target != null ? StringUtils.trimToNull(target.getPos()) : null;
    }

    public UserType ensureUserTarget(UserType user, TargetInput target) {
        if (user == null || target == null) {
            return user;
        }

        String companyId = normalizeTargetCompany(target);
        if (companyId == null) {
            return user;
        }

        UserType.TargetType currentTarget = user.getTarget();
        String currentCompany = currentTarget != null ? StringUtils.trimToNull(currentTarget.getCompany()) : null;
        if (currentCompany != null) {
            return user;
        }

        UserType.TargetType nextTarget = currentTarget != null ? currentTarget : new UserType.TargetType();
        nextTarget.setCompany(companyId);
        if (StringUtils.isBlank(nextTarget.getPos())) {
            nextTarget.setPos(normalizeTargetPos(target));
        }
        user.setTarget(nextTarget);
        return userRepository.save(user);
    }

    private UserType resolveOrCreateCustomer(BookingCustomerInput contact, TargetInput requestTarget) {
        if (contact == null) {
            throw new BadRequestException("INVALID_CONTACT: contact is required");
        }

        String normalizedEmail = normalizeEmail(contact.getEmail());
        PhoneType normalizedPhone = normalizePhone(contact.getPhone());
        if (normalizedEmail == null && normalizedPhone == null) {
            throw new BadRequestException("INVALID_CONTACT: email or phone is required");
        }

        if (normalizedPhone != null) {
            Optional<UserType> existingByPhone = userRepository.findByPhone_CountryCodeAndPhone_Number(
                    normalizedPhone.getCountryCode(),
                    normalizedPhone.getNumber());
            if (existingByPhone.isPresent()) {
                return ensureUserTarget(existingByPhone.get(), requestTarget);
            }
        }

        if (normalizedEmail != null) {
            Optional<UserType> existingFrontCustomer = userRepository.findByEmailAndApp(normalizedEmail, AppEnum.FRONT);
            if (existingFrontCustomer.isPresent()) {
                return ensureUserTarget(existingFrontCustomer.get(), requestTarget);
            }

            UserType existingByEmail = selectBestEmailCandidate(userRepository.findAllByEmail(normalizedEmail), requestTarget);
            if (existingByEmail != null) {
                return ensureUserTarget(existingByEmail, requestTarget);
            }
        }

        String firstName = StringUtils.trimToNull(contact.getFirstName());
        String lastName = StringUtils.trimToNull(contact.getLastName());
        if (firstName == null || lastName == null) {
            throw new BadRequestException(
                    "CUSTOMER_NAME_REQUIRED: firstName and lastName are required when creating a new customer");
        }

        UserType user = new UserType();
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(normalizedEmail);
        user.setPhone(normalizedPhone);
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setRole(RoleEnum.CUSTOMER);
        user.setApp(AppEnum.FRONT);
        applyUserTargetIfMissing(user, requestTarget);
        return userRepository.save(user);
    }

    private void applyUserTargetIfMissing(UserType user, TargetInput target) {
        if (user == null || target == null) {
            return;
        }

        String companyId = normalizeTargetCompany(target);
        if (companyId == null) {
            return;
        }

        UserType.TargetType currentTarget = user.getTarget();
        String currentCompany = currentTarget != null ? StringUtils.trimToNull(currentTarget.getCompany()) : null;
        if (currentCompany != null) {
            return;
        }

        UserType.TargetType nextTarget = currentTarget != null ? currentTarget : new UserType.TargetType();
        nextTarget.setCompany(companyId);
        if (StringUtils.isBlank(nextTarget.getPos())) {
            nextTarget.setPos(normalizeTargetPos(target));
        }
        user.setTarget(nextTarget);
    }

    private String normalizeEmail(String email) {
        return StringUtils.lowerCase(StringUtils.trimToNull(email));
    }

    private PhoneType normalizePhone(PhoneType phone) {
        if (phone == null) {
            return null;
        }

        String countryCode = StringUtils.trimToNull(phone.getCountryCode());
        String number = StringUtils.trimToNull(phone.getNumber());
        if (countryCode == null && number == null) {
            return null;
        }
        if (countryCode == null || number == null) {
            throw new BadRequestException("INVALID_CONTACT_PHONE: countryCode and number are required together");
        }

        PhoneType normalized = new PhoneType();
        normalized.setCountryCode(countryCode);
        normalized.setNumber(number);
        return normalized;
    }

    private UserType selectBestEmailCandidate(List<UserType> candidates, TargetInput target) {
        if (candidates == null || candidates.isEmpty()) {
            return null;
        }

        String targetCompany = normalizeTargetCompany(target);
        return candidates.stream()
                .max(Comparator
                        .comparingInt((UserType user) -> scoreCandidate(user, targetCompany))
                        .thenComparing(UserType::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .orElse(null);
    }

    private int scoreCandidate(UserType user, String targetCompany) {
        int score = 0;
        String userCompany = user.getTarget() != null ? StringUtils.trimToNull(user.getTarget().getCompany()) : null;
        if (targetCompany != null && StringUtils.equals(targetCompany, userCompany)) {
            score += 4;
        }
        if (user.getApp() == AppEnum.FRONT) {
            score += 2;
        }
        if (user.getRole() == RoleEnum.CUSTOMER) {
            score += 1;
        }
        return score;
    }
}
