# WEC fixed-input audit — 2026-11-10

This audit does not change a prior, bound or production value. An empty numeric cell means the value is not verified. A dry minimum is not the car's total running mass. The power curves are measured at the wheels; they are not an engine-power figure.

| Class | Season | Minimum dry design mass, kg | Reference power curve peaks low/base/high, kW | Event stint-energy limit, MJ | Numeric aero coefficient limit | Source / issue date | Articles |
|---|---:|---:|---:|---|---|---|---|
| LMH | 2025 | 1030 | 480 / 500 / 520 | Event BoP table | | [LMH 2025][lmh25], WMSC 2024-10-17; published 2024-10-18 | 4.1; 5.1.2 and Appendix 4b; 6.8; 3.7.3 |
| LMH | 2026 | 1030 | 480 / 500 / 520 | | | [LMH 2026][lmh26], WMSC 2025-10-16; published 2025-10-17 | 4.1; 5.1.2 and Appendix 4b; 6.8; 3.7.3 |
| LMDh | 2025 | 1030 | 480 / 500 / 520 | Event BoP table | | [LMDh 2025][lmdh25], revision 2025-04-02 | 4.1; 5.1.2; 6.8; 3.9.3 |
| LMDh | 2026 | 1030 | 480 / 500 / 520 | | | [LMDh 2026][lmdh26], revision 2025-10-16 | 4.1; 5.1.2; 6.8; 3.9.3 |
| LMGT3 | 2025 | | | | | [LMGT3 2025][gt25], WMSC 2024-12-11; published 2024-12-12 | 4.1; 5.2; 6.5 |
| LMGT3 | 2026 | | | | | [LMGT3 2026][gt26], WMSC 2025-10-16; published 2025-10-17 | 4.1; 5.2; 6.5 |

The Hypercar reference curve is subject to event BoP. Its high reference peak is not a universal cap at every speed: the event tables also specify a power adjustment above their speed threshold. LMGT3 mass, selected power curve and stint energy depend on its event BoP and homologated model. No single class value is inferred. No numeric 2026 event BoP was verified.

| Dry event | Hypercar decision | Issue date | Article | Verified model rows |
|---|---|---|---|---:|
| Qatar | [D09 amended][qatar] | 2025-02-20 | Sporting 6.2.1 | 8 |
| Imola | [D18 amended][imola] | 2025-04-16 | Sporting 6.2.1 | 8 |
| Spa | [D24][spa] | 2025-05-05 | Sporting 6.2.1 | 8 |
| Sao Paulo | [D36][interlagos] | 2025-07-07 | Sporting 6.2.1 | 8 |
| Bahrain | [D46][sakhir] | 2025-10-31 | Sporting 6.2.1 | 8 |

The derived table `scripts/sim/data/wec-bop-verified-2025.json` records the exact model, event, minimum dry mass, power below the threshold, high-speed adjustment and stint energy. All rows agree with the existing repository values. Austin is wet and excluded from this dry fit.

The model map uses exact season, event and entry number from official Al Kamel classifications. It preserves leading zeros. It does not match the first word of a manufacturer. The 2026 Toyota model is distinct from the 2025 model.

The accessible LMH and LMDh rules point to separate aerodynamic homologation criteria. The downloaded LMDh competitor appendix did not supply a usable numeric coefficient limit. Manufacturer-specific homologation maps were not available. Those limits remain empty; the fitted downforce bound is not treated as a verified regulation limit.

PDF SHA-256 values and access status are in `scripts/sim/data/wec-fixed-input-sources.json`. The 2025 LMGT3 indexed official text was readable, but both current PDF URLs returned HTTP 404; no numeric fit input was taken from that document. Raw third-party PDFs are not committed.

[lmh25]: https://www.fia.com/sites/default/files/2025_lmh_technical_regs_2024.10.17_published_2024.10.18_clean_version.pdf
[lmh26]: https://www.fia.com/system/files/documents/2026_lmh_technical_regs_2025.10.16_published_2025.10.17_clean_version_0.pdf
[lmdh25]: https://www.imsa.com/wp-content/uploads/sites/32/2025/10/23/LMDh-Technical-Regulations-2025.04.02-blackline.pdf
[lmdh26]: https://www.fia.com/system/files/documents/lmdh-technical-regulations-2025.10.16-blackline.pdf
[gt25]: https://www.fia.com/sites/default/files/2025_lmgt3_technical_regulations_2024.12.11_published_2024.12.12_marked_up_version.pdf
[gt26]: https://www.fia.com/system/files/documents/2026_lmgt3_technical_regulations_2025.10.16_published_2025.10.17_clean_version.pdf
[qatar]: https://www.fia.com/sites/default/files/wec_2025_d09_hypercar_bop_amended_20022025.pdf
[imola]: https://www.fia.com/sites/default/files/wec_2025_d18_hypercar_bop_amended_16042025.pdf
[spa]: https://www.fia.com/sites/default/files/wec_2025_d24_hypercar_bop_05052025.pdf
[interlagos]: https://www.fia.com/sites/default/files/wec_2025_d36_hypercar_bop_07072025.pdf
[sakhir]: https://www.fia.com/sites/default/files/wec_2025_d46_hypercar_bop_31102025.pdf
