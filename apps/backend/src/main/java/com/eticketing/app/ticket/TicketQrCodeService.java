package com.eticketing.app.ticket;

import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import javax.imageio.ImageIO;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.WriterException;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;

@Service
public class TicketQrCodeService {

    private static final Logger LOGGER = LoggerFactory.getLogger(TicketQrCodeService.class);

    public String generateDataUri(String payload) {
        if (payload == null || payload.isBlank()) {
            return "";
        }
        try {
            QRCodeWriter qrCodeWriter = new QRCodeWriter();
            BitMatrix bitMatrix = qrCodeWriter.encode(payload, BarcodeFormat.QR_CODE, 256, 256);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(MatrixToImageWriter.toBufferedImage(bitMatrix), "png", baos);
            String base64 = Base64.getEncoder().encodeToString(baos.toByteArray());
            return "data:image/png;base64," + base64;
        } catch (WriterException | java.io.IOException ex) {
            LOGGER.error("Unable to generate QR code", ex);
            String fallback = Base64.getEncoder().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
            return "data:text/plain;base64," + fallback;
        }
    }

    public String generatePublicUrl(String payload) {
        if (payload == null || payload.isBlank()) {
            return "";
        }
        return "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data="
                + URLEncoder.encode(payload, StandardCharsets.UTF_8);
    }
}
