package com.eticketing.app.company;

import com.eticketing.app.common.PictureType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Company document — represents a transport operator on the platform. Each
 * company owns one or more POS and hires drivers/agents.
 */
@Document("companies")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompanyType {

    @Id
    private String id;

    private String name;

    private String legalName;

    @Indexed(name = "taxId_unique_idx", unique = true, sparse = true)
    private String taxId;

    @Builder.Default
    private CompanyStatus status = CompanyStatus.ACTIVE;

    @Builder.Default
    private BigDecimal platformFeePercentage = new BigDecimal("5.0");

    private String currencyId;

    private String emailTemplate;

    private PictureType picture;

    private BankAccountType bankAccount;

    private ContactType contact;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
