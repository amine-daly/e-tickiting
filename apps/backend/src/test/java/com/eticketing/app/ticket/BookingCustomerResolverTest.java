package com.eticketing.app.ticket;

import com.eticketing.app.common.TargetInput;
import com.eticketing.app.ticket.dto.BookingCustomerInput;
import com.eticketing.app.user.AppEnum;
import com.eticketing.app.user.PhoneType;
import com.eticketing.app.user.RoleEnum;
import com.eticketing.app.user.UserType;
import com.eticketing.app.user.UserTypeRepository;
import com.eticketing.app.web.error.ApiExceptions.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingCustomerResolverTest {

    @Mock
    private UserTypeRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private BookingCustomerResolver bookingCustomerResolver;

    @Test
    void resolveOrCreatePosContactReusesExistingPhoneCustomerAndBackfillsTarget() {
        BookingCustomerInput contact = new BookingCustomerInput();
        PhoneType phone = new PhoneType("+216", "612345678");
        contact.setPhone(phone);

        UserType existing = new UserType();
        existing.setId("user-1");
        existing.setPhone(phone);

        when(userRepository.findByPhone_CountryCodeAndPhone_Number("+216", "612345678"))
                .thenReturn(Optional.of(existing));
        when(userRepository.save(existing)).thenAnswer(invocation -> invocation.getArgument(0));

        UserType resolved = bookingCustomerResolver.resolveOrCreatePosContact(
                contact,
                new TargetInput("company-1", "pos-1"));

        assertEquals("user-1", resolved.getId());
        assertNotNull(resolved.getTarget());
        assertEquals("company-1", resolved.getTarget().getCompany());
        assertEquals("pos-1", resolved.getTarget().getPos());
        verify(userRepository).save(existing);
        verify(userRepository, never()).findByEmailAndApp(anyString(), any());
    }

    @Test
    void resolveOrCreatePosContactCreatesNewFrontCustomerWhenNoMatchExists() {
        BookingCustomerInput contact = new BookingCustomerInput();
        contact.setFirstName("Nora");
        contact.setLastName("Ben Ali");
        contact.setEmail(" Nora@example.com ");

        when(userRepository.findByEmailAndApp("nora@example.com", AppEnum.FRONT)).thenReturn(Optional.empty());
        when(userRepository.findAllByEmail("nora@example.com")).thenReturn(List.of());
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-password");
        when(userRepository.save(any(UserType.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserType created = bookingCustomerResolver.resolveOrCreatePosContact(
                contact,
                new TargetInput("company-9", null));

        assertEquals("Nora", created.getFirstName());
        assertEquals("Ben Ali", created.getLastName());
        assertEquals("nora@example.com", created.getEmail());
        assertEquals(RoleEnum.CUSTOMER, created.getRole());
        assertEquals(AppEnum.FRONT, created.getApp());
        assertNotNull(created.getTarget());
        assertEquals("company-9", created.getTarget().getCompany());
    }

    @Test
    void resolveOrCreatePosContactRejectsCreateWithoutNames() {
        BookingCustomerInput contact = new BookingCustomerInput();
        contact.setPhone(new PhoneType("+216", "612345678"));

        when(userRepository.findByPhone_CountryCodeAndPhone_Number("+216", "612345678"))
                .thenReturn(Optional.empty());

        BadRequestException error = assertThrows(
                BadRequestException.class,
                () -> bookingCustomerResolver.resolveOrCreatePosContact(contact, new TargetInput("company-1", null)));

        assertEquals(
                "CUSTOMER_NAME_REQUIRED: firstName and lastName are required when creating a new customer",
                error.getMessage());
    }
}
