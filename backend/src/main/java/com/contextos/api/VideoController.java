package com.contextos.api;

import com.contextos.manifest.ContextManifest;
import com.contextos.video.AnalyzeVideoRequest;
import com.contextos.video.VideoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/videos")
public class VideoController {
  private final VideoService videoService;

  public VideoController(VideoService videoService) {
    this.videoService = videoService;
  }

  @PostMapping("/analyze")
  public ContextManifest analyze(@Valid @RequestBody AnalyzeVideoRequest request) {
    return videoService.analyze(request);
  }

  @GetMapping("/{videoId}")
  public ResponseEntity<ContextManifest> getVideo(@PathVariable String videoId) {
    return videoService.find(videoId)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.notFound().build());
  }
}
