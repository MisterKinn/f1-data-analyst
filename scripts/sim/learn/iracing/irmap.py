# Offline: reads the owner's local iRacing extract (SRS env var, default ~/srs: sessions.jsonl + channels/*.parquet; personal use,
# never committed). Outputs only derived numbers. Run from the repo root.
# iRacing track names (sessions.jsonl 'track') -> our track ids (same layout only)
IR = {'algarve gp': 'portimao', 'bathurst': 'bathurst', 'brandshatch grandprix': 'brands-hatch', 'cota gp': 'austin', 'daytona 2011 road': 'daytona',
      'fuji gp': 'fuji', 'hungaroring': 'hungaroring', 'imola gp': 'imola', 'indianapolis 2022 road': 'indianapolis', 'interlagos gp': 'interlagos',
      'lemans full': 'le-mans', 'longbeach': 'long-beach', 'mexicocity gp': 'mexico-city', 'miami gp': 'miami', 'misano gp': 'misano',
      'montreal': 'montreal', 'monza full': 'monza', 'mugello gp': 'mugello', 'okayama full': 'okayama', 'oschersleben gp': 'oschersleben',
      'phillipisland': 'phillip-island', 'roadamerica 2026 full': 'road-america', 'roadatlanta full': 'road-atlanta', 'sebring international': 'sebring',
      'silverstone 2019 gp': 'silverstone', 'spa 2024 up': 'spa-francorchamps', 'spielberg gp': 'spielberg', 'suzuka grandprix': 'suzuka',
      'twinring fullrc': 'motegi', 'virginia 2022 full': 'vir', 'watkinsglen 2021 fullnoloop': 'watkins-glen', 'zandvoort 2023 gp': 'zandvoort',
      'zolder gp': 'zolder', 'sonoma 2025 nascarlong': 'sonoma'}
