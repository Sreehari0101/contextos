package com.contextos.api;

import com.contextos.context.ContextDecision;
import com.contextos.context.ContextReason;
import com.contextos.context.ContextPolicyEngine;
import com.contextos.manifest.ContextManifest;
import com.contextos.video.ProcessingStatus;
import com.contextos.video.VideoService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/context")
public class ContextController {
  private final VideoService videoService;
  private final ContextPolicyEngine policyEngine;

  public ContextController(VideoService videoService, ContextPolicyEngine policyEngine) {
    this.videoService = videoService;
    this.policyEngine = policyEngine;
  }

  @GetMapping("/current")
  public ContextDecision current(@RequestParam String videoId, @RequestParam int timestamp) {
    return videoService.manifestForCurrentContext(videoId)
        .map(manifest -> decideFromManifest(manifest, timestamp))
        .orElseGet(() -> policyEngine.unavailable(videoId, timestamp, ProcessingStatus.ANALYZING, ContextReason.ANALYSIS_NOT_READY));
  }

  private ContextDecision decideFromManifest(ContextManifest manifest, int timestamp) {
    if (manifest.status() == ProcessingStatus.NO_CONTEXT_REQUIRED) {
      return policyEngine.quiet(manifest, timestamp);
    }

    if (manifest.status() == ProcessingStatus.FAILED) {
      return policyEngine.unavailable(manifest.videoId(), timestamp, ProcessingStatus.FAILED, ContextReason.ANALYSIS_FAILED);
    }

    return manifest.segments().stream()
        .filter(segment -> segment.contains(timestamp))
        .findFirst()
        .map(segment -> policyEngine.decide(manifest, timestamp, segment))
        .orElseGet(() -> policyEngine.unavailable(manifest.videoId(), timestamp, ProcessingStatus.READY, ContextReason.NO_SEGMENT_AT_TIMESTAMP));
  }
}
