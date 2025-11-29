package com.eticketing.app.agency;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import com.eticketing.app.user.PhoneType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Document(collection = "agencies")
public class AgencyType {

    @Id
    private String id;
    @NotBlank
    private String name;

    @NotBlank
    private String address;
    private String email;

    @Valid
    @NotNull
    private PhoneType phone;
    private String template;

    // Getters and setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public PhoneType getPhone() {
        return phone;
    }

    public void setPhone(PhoneType phone) {
        this.phone = phone;
    }

    public String getTemplate() {
        return template;
    }

    public void setTemplate(String template) {
        this.template = template;
    }
}
