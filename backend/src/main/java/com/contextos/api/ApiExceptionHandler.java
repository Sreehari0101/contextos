package com.contextos.api;

import com.contextos.bridge.BridgeGenerationException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(IllegalArgumentException.class)
  ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException error) {
    return ResponseEntity.badRequest().body(Map.of("error", error.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<Map<String, String>> validation(MethodArgumentNotValidException error) {
    return ResponseEntity.badRequest().body(Map.of("error", "Invalid request"));
  }

  @ExceptionHandler(BridgeGenerationException.class)
  ResponseEntity<Map<String, String>> bridgeFailure(BridgeGenerationException error) {
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
        .body(Map.of("error", "Bridge generation failed"));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> serverError(Exception error) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(Map.of("error", "ContextOS backend error"));
  }
}
