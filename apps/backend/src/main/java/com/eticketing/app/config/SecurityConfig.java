package com.eticketing.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.eticketing.app.security.JwtAuthFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtAuthFilter jwtAuthFilter) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/places", "/api/places/*").permitAll()
                .requestMatchers(HttpMethod.PUT, "/api/trip/*/seats", "/api/trips/*/seats").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/trip/*/seats/generate", "/api/trips/*/seats/generate").permitAll()
                .requestMatchers("/api/files", "/api/files/**").permitAll()
                .requestMatchers("/api/frontoffice/**").permitAll()
                .requestMatchers("/api/bookings/**").hasAnyRole("ADMIN", "MANAGER", "COMPANY_ADMIN", "POS_AGENT")
                .requestMatchers("/api/trip/**", "/api/trips/**").permitAll()
                .requestMatchers("/api/buses", "/api/buses/**").permitAll()
                .requestMatchers("/api/companies", "/api/companies/**").permitAll()
                .requestMatchers("/api/pos", "/api/pos/**").permitAll()
                .requestMatchers("/api/health", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**", "/api/auth/**").permitAll()
                .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowCredentials(true);
        // For development, allow all origins. Spring will echo the request Origin instead of '*'.
        cfg.setAllowedOriginPatterns(java.util.List.of("*"));
        cfg.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        cfg.setAllowedHeaders(java.util.List.of("*"));
        cfg.setExposedHeaders(java.util.List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
