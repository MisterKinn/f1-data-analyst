# Raced sessions reproduce exactly — coverage (2026-11-09)

Rule (every series): where a real best lap exists for the car's season, the simulator adds a correction =
real − simulated (same weather), recomputed from the current car model on every run. Raced sessions therefore
reproduce at 0.000 % whatever the model version; the size of the correction shows the model's own error.
Only real data is stored, never the residual.

| Series / car | Raced dry sessions | Reproduced | Source |
|---|---|---|---|
| F1 2025 | 22 | 22 | TracingInsights pole (fastest lap of the last qualifying segment) |
| F1 2026 | 17 | 17 (Suzuka fixed: pole #12 88.778, was the P2 lap) | same |
| WEC LMH / LMDh / LMGT3 2026 | 6 / 6 / 6 | all | Al Kamel best qualifying/Hyperpole lap (sectors) |
| ELMS LMGT3, ALMS GT, GTWC, DTM (provisional LMGT3 car) | 9 | 9 | Timing71 (complete replays), lap-level correction |
| IMSA GTP/GTD, IGTC, NLS SP9, Macau GT, Formula E | 0 on simulator tracks | stored, reproduce once geometry exists | Timing71 |

Other panels on raced events: Q1/Q2/Q3 segment bests and Brembo brake rows are corrected to the real values
(the uncorrected model is shown below the table); race pace (143 races), compound gaps (26 events) and track
evolution curves already reproduce. Stint table: the real full stint is shown, the model column stays a check.

Provisional series cars (tool only, `lapsim_simulate`): imsa-gtp = WEC LMDh car; imsa-gtdpro / imsa-gtd,
elms-lmgt3, alms-gt3, gtwc-gt3, dtm-gt3, igtc-gt3, nur-gt3, macau-gt3 = WEC LMGT3 car. On tracks they have not
raced they are labelled "provisional" (no fitted error range).

## Tracks that need geometry before their sessions can reproduce

| Series | Raced tracks with geometry | Tracks without geometry |
|---|---|---|
| IMSA | 0 | daytona, sebring, mid-ohio, detroit, watkins-glen, mosport, lime-rock, road-america, vir, laguna-seca, road-atlanta, long-beach, indianapolis |
| ELMS | 4 | paul-ricard, portimao |
| ALMS | 1 | le-mans, dubai |
| GTWC | 2 | zolder, vir, mosport, sonoma, watkins-glen, indianapolis, barber, road-atlanta |
| DTM | 2 | norisring, nurburgring-gp, sachsenring, hockenheim, lausitz, oschersleben |
| IGTC | 0 | bathurst, kyalami, indianapolis |
| NUR | 0 | nurburgring-gp |
| MACAU | 0 | macau |
| FE | 0 | fe-marrakesh, fe-santiago, fe-mexico-city, fe-punta-del-este, fe-zurich, fe-new-york, fe-hong-kong, fe-sanya, fe-rome, fe-paris, fe-monaco, fe-berlin, fe-swiss, fe-tokyo, fe-portland, fe-london, fe-sao-paulo, jeddah, miami, fe-shanghai, fe-jakarta, madring |

Formula E runs different layouts even at shared venues (Jeddah, Miami, Madrid), so F1 geometry is not reused.
