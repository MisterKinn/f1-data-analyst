# Per-model Hypercar: what the existing results mean

Analysis only; no new fit. Keep rejected for production.

## Each model’s own best lap on a hidden track

One error per model-event best lap; all entries from that track were hidden. n is model-event cells, not independent tracks. The paired gate uses independent track clusters.

| Class-season | Model-event n | Tracks | Class-base RMS % | Per-model RMS % |
|---|---:|---:|---:|---:|
| wec-lmdh/2025 | 20 | 5 | 1.555579 | 1.539785 |
| wec-lmdh/2026 | 24 | 6 | 1.105933 | 1.096921 |
| wec-lmh/2025 | 20 | 5 | 1.694380 | 1.423168 |
| wec-lmh/2026 | 24 | 6 | 1.213176 | 1.212137 |

## The class-best lap

| Class-season | n | Production RMS % | All-car base RMS % | Per-model RMS % |
|---|---:|---:|---:|---:|
| wec-lmdh/2025 | 5 | 1.281673 | 1.684012 | 1.729234 |
| wec-lmdh/2026 | 6 | 1.055043 | 1.178463 | 1.206808 |
| wec-lmh/2025 | 5 | 1.112168 | 1.726714 | 1.486128 |
| wec-lmh/2026 | 6 | 1.110032 | 1.334708 | 1.392195 |

The all-car base already predicts class-best laps worse than production in every group. Production trains on the top three laps per class; the all-car fit targets the wider field. Model offsets are shrunk toward that base. The offsets improve LMH 2025 class-best error but worsen the other three groups. Thus the loss is not solely caused by adding model offsets: the different training target is already a major part of it. This explanation is supported by the comparisons, not a separate causal experiment.

## Fitted differences from the hierarchy class base

Effective fitted values, not measured aerodynamic facts. Delta units: cdA and clA in m²; muY dimensionless. Bounds are current declared fitting bounds, not verified homologation limits.

| Group / model | cdA | ΔcdA | clA | ΔclA | muY | ΔmuY | At bound | Own-lap n | Base RMS % | Model RMS % |
|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|
| wec-lmdh/2025 / Alpine A424 | 1.118472 | 0.005406 | 6.988736 | -0.004772 | 1.528883 | -0.009235 | none | 5 | 1.505944 | 1.462530 |
| wec-lmdh/2025 / BMW M Hybrid V8 | 1.110759 | -0.002307 | 6.999998 | 0.006490 | 1.542658 | 0.004540 | clA upper | 5 | 1.533382 | 1.559552 |
| wec-lmdh/2025 / Cadillac V-Series.R | 1.113958 | 0.000891 | 7.000000 | 0.006492 | 1.546418 | 0.008299 | clA upper | 5 | 1.707687 | 1.663005 |
| wec-lmdh/2025 / Porsche 963 | 1.109179 | -0.003888 | 6.987104 | -0.006404 | 1.534941 | -0.003177 | none | 5 | 1.464234 | 1.465253 |
| wec-lmdh/2026 / Alpine A424 | 0.970762 | 0.000490 | 6.309323 | 0.007151 | 1.532242 | 0.008184 | none | 6 | 1.114739 | 1.077999 |
| wec-lmdh/2026 / BMW M Hybrid V8 | 0.970733 | 0.000461 | 6.293595 | -0.008576 | 1.516220 | -0.007838 | none | 6 | 0.978411 | 0.966939 |
| wec-lmdh/2026 / Cadillac V-Series.R | 0.968333 | -0.001939 | 6.305731 | 0.003559 | 1.527475 | 0.003417 | none | 6 | 1.072412 | 1.048312 |
| wec-lmdh/2026 / Genesis GMR-001-Hypercar | 0.971424 | 0.001152 | 6.299116 | -0.003056 | 1.520811 | -0.003247 | none | 6 | 1.241915 | 1.271585 |
| wec-lmh/2025 / Aston Martin Valkyrie | 1.065177 | 0.006698 | 6.935309 | -0.030999 | 1.494710 | -0.030987 | none | 5 | 2.027288 | 1.541225 |
| wec-lmh/2025 / Ferrari 499P | 1.047818 | -0.010660 | 7.000000 | 0.033691 | 1.558726 | 0.033029 | clA upper | 5 | 1.717607 | 1.353993 |
| wec-lmh/2025 / Peugeot 9X8 | 1.066703 | 0.008224 | 6.965978 | -0.000331 | 1.517093 | -0.008603 | none | 5 | 1.543141 | 1.465058 |
| wec-lmh/2025 / Toyota GR010 - Hybrid | 1.054223 | -0.004255 | 6.966472 | 0.000163 | 1.533405 | 0.007708 | none | 5 | 1.429103 | 1.321574 |
| wec-lmh/2026 / Aston Martin Valkyrie | 0.967780 | -0.001103 | 6.469062 | -0.004509 | 1.505359 | -0.004342 | none | 6 | 1.284600 | 1.301285 |
| wec-lmh/2026 / Ferrari 499P | 0.970353 | 0.001470 | 6.478421 | 0.004850 | 1.515492 | 0.005791 | none | 6 | 1.235271 | 1.180279 |
| wec-lmh/2026 / Peugeot 9X8 | 0.967901 | -0.000982 | 6.474129 | 0.000558 | 1.510113 | 0.000412 | none | 6 | 1.225010 | 1.264249 |
| wec-lmh/2026 / Toyota TR010 Hybrid | 0.969383 | 0.000500 | 6.472368 | -0.001203 | 1.507966 | -0.001735 | none | 6 | 1.100201 | 1.091959 |

Continuing per-car research is plausible for GT3 because its output target is each model’s lap, rather than the class winner. The strongest existing evidence is LMH 2025, especially Valkyrie and Ferrari. Most other improvements are tiny. This is not proof for GT3: its held-out work is incomplete and remains parked. A future separately declared GT3 study should judge per-model hidden-track error against the same all-car base, report track-cluster uncertainty and require enough tracks; it must not reuse this evidence as a GT3 pass.

All four completed Hypercar groups and 38 fold inventories passed an independent arithmetic/data-membership audit.
