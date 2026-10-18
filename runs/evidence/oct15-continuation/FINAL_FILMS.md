# October 15 launch-film delivery

Three actual brag launch films are published and verified. Native 3840 × 2160 masters and 1920 × 1080 web editions use constant 30 fps, H.264 (yuv420p) and AAC at 48 kHz. This closes the film artifact gate for the pending trio. October 15 applications remain **0/3 released**; the completed collection remains **24** and October 14 remains complete **3/3**. AsterLedger and ForgePulse remain separate additional work with their existing PostgreSQL storage slices and unfinished M1.

[Release, posters, probes and checksums](https://github.com/pranavp2418/Oaks_October/releases/tag/agent-product-films-v1).

| Film | Runtime | 4K size / overall bitrate | Web size / overall bitrate | Videos |
|---|---|---|---|---|
| Lintel | 45 s | 8,243,168 bytes / 1.465 Mb/s | 3,680,634 bytes / 0.654 Mb/s | [1080p](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/lintel-launch.mp4) · [4K](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/lintel-launch-4k.mp4) |
| Portwise | 50 s | 7,411,377 bytes / 1.186 Mb/s | 3,290,364 bytes / 0.526 Mb/s | [1080p](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/portwise-launch.mp4) · [4K](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/portwise-launch-4k.mp4) |
| Fallow | 45 s | 8,503,913 bytes / 1.512 Mb/s | 3,424,254 bytes / 0.609 Mb/s | [1080p](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/fallow-launch.mp4) · [4K](https://github.com/pranavp2418/Oaks_October/releases/download/agent-product-films-v1/fallow-launch-4k.mp4) |

Bitrates include audio and container overhead. Per-stream bitrates, frame counts, codec profiles and SHA256 are retained in [final-film-encodes.json](final-film-encodes.json) and each project's launch probes.

## Installation and actual production

The supported Codex plugin commands installed and enabled [brag 0.4.0](https://github.com/latent-spaces/brag) in this cloud environment. Upstream commit: `069432cac935ed1895859df201c31436c07fb74e`. Installed and upstream SKILL.md SHA256 match: `4cd47d39c35bbc70d99ad6ad76aaae7b15b84f14721cf94fd65417fd51658cae`. Instructions, license and current workflow were read and applied; the MIT notice is retained per project.

Hyperframes 0.8.169, native-resolution Chromium captures/compositions and FFmpeg 7.1.5 produced real local masters. Rendering used software screenshots on the cloud's 3-CPU/8-GiB allocation. A resource-pressure capture failure was recovered; only completed owned frame caches in RAM-backed /tmp were cleared. No GPU or paid-resource claim is made.

Direct `uploads.github.com` requests returned 401 for both MP4 and poster uploads, although Git pushes and release writes worked. An empty release was briefly published before that failed result was reconciled, then returned to draft. It was not delivery evidence. The existing standard public-repository [Actions runner](https://github.com/pranavp2418/Oaks_October/actions/runs/39096657211) then re-rendered identical composition/asset inputs and successfully uploaded all 18 assets with its scoped repository token. Delivery used Node 24.21.0, FFmpeg 6.1.1 and Chrome for Testing 151.0.7922.34; the complete toolchain record accompanies the release. Render source: `739fa55092731b6b96ee8245a7235fa113ccfe5b`.

The candidate files were downloaded before final publication. All six MP4 hashes and sizes match the runner manifest and release digests; composition/asset hashes match the locally reviewed source. Both editions fully decoded in Actions. Every project retains its editable composition, native capture/helper, original synthesized score, storyboard, brief, license/provenance, reproducible commands, final QA and ordered/native proof frames. No rendered MP4 blobs or supplied private attachments were committed. Existing public resume assets were preserved.

## Editorial and playback verification

The complete ordered one-second frame sequences and native workflow/proof frames were reviewed again from the delivery bytes. Lintel's cold-load flash, title overlap and result framing were corrected; the prepared dossier is visible. Portwise now shows diagnosis before human acceptance and application, with a readable minimum-weight 12 repair across five changes. Fallow has an original site map and Beta-density comparison: collecting synthetic 650 changes Willow from α2/β2/mean 50% to α3/β2/mean 60%; the selected allocation remains unchanged.

All three **public** web MP4s played start-to-ended at 1× through the built portfolio player in Chromium: 1,350 / 1,500 / 1,350 presented frames, zero dropped frames, zero seeking and zero media errors. Audio decoded successfully. Lazy paused loading, Escape cleanup, restored focus and the 390-pixel layout passed. See [public-film-playback.json](public-film-playback.json) and [published-editorial-review.json](published-editorial-review.json). This is automated full playback plus visual frame review; no human-viewing or complete accessibility certification is claimed.

Measured final master audio is −18.09 / −18.21 / −18.09 LUFS, with true peaks −8.89 / −8.95 / −8.29 dBTP. Original scores and cue accents use no outside samples or paid service. Captures are actual synthetic workflows, explicitly edited for time. Lintel uses production footage; Portwise/Fallow use local builds and say so. Reviewed frames contain no private profile inputs, secrets or visible project dates. No customer, independent reviewer, physical-device, scientific-validation or Fallow LLM claim is made.

## Portfolio and remaining blockers

The pushed film-room source connects each project presentation to a user-initiated lazy player and 4K download. The production build and 28 existing portfolio tests passed. Native gstack browser preflight and Chromium keyboard/dialog checks passed; measured foreground contrast is 8.9:1–15:1. A final 390-pixel / 4× CPU check measured 284 ms first contentful paint and zero initial MP4 requests. This uses local transport and device emulation. Existing cards, catalog, country and accepted scenery are unchanged.

**The production portfolio has not received the film page.** Its authorized deployment of source `fec8cec2858387f266a89a30b014a4e2ffa5a3c8` was rejected at `2026-10-18T04:16:44.224Z`: HTTP 402, `api-deployments-free-per-day`, more than 100 deployments, `retryAfter=86400`. Request: `iad1:sfo1::64xkn-1792297004224-7d495dc7f937`. No billing upgrade, alternate team or routine reapproval was attempted. The same quota blocks Portwise/Fallow production and Lintel's latest journal-guard redeploy. A retry hint is not a guaranteed reset.

Formal CEO/engineering/design/eval/release reviews and full security signoff remain open. The application [CI at fec8cec](https://github.com/pranavp2418/Oaks_October/actions/runs/39096509134) passed all three jobs. Both prior ChatGPT tasks remain paused; an actual Codex destination and next run remain unverified. Frozen exports verify 5/5. See [RELEASE_GATES.md](RELEASE_GATES.md), [deployment evidence](film-portfolio-deploy.json), the dated run and each project's `launch/FINAL_QA.md` for the remaining conditions.
