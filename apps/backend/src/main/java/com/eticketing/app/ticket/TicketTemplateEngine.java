package com.eticketing.app.ticket;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

@Component
public class TicketTemplateEngine {

    private static final Pattern TOKEN_PATTERN = Pattern.compile("\\{\\{\\s*([a-zA-Z0-9_.-]+)\\s*\\}\\}");

    public String render(String template, Map<String, Object> context) {
        String workingTemplate = (template == null || template.isBlank()) ? TicketTemplateDefaults.defaultTemplate() : template;
        Map<String, Object> safeContext = context != null ? context : Map.of();
        Matcher matcher = TOKEN_PATTERN.matcher(workingTemplate);
        StringBuffer rendered = new StringBuffer();
        while (matcher.find()) {
            String key = matcher.group(1);
            Object replacement = safeContext.getOrDefault(key, "");
            matcher.appendReplacement(rendered, Matcher.quoteReplacement(replacement != null ? replacement.toString() : ""));
        }
        matcher.appendTail(rendered);
        return rendered.toString();
    }
}
