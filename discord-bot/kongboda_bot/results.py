"""Complete, bounded Discord result pages; preserve provenance and missing values."""
import math
from urllib.parse import urlsplit


def source_link(value):
    if not isinstance(value, str):
        return ''
    parsed = urlsplit(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        return ''
    return value.replace('>', '%3E').replace('<', '%3C').replace('\n', '')


def clean(value, limit=100):
    # Timing/provider strings must not produce pings, code fences or extra rows.
    return str(value if value is not None else '—').replace('@', '@\u200b').replace('`', '').replace('\n', ' ')[:limit]


def seconds(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        return '—'
    millis = round(value * 1000)
    minutes, rest = divmod(millis, 60000)
    return f'{minutes}:{rest / 1000:06.3f}'


def pages(header, lines, footer=''):
    # Repeat the identity on each page; never silently drop lower positions.
    header, footer = header[:600], footer[:650]
    result, batch = [], []
    for line in lines:
        line = line[:500]
        if batch and len('\n'.join([header, *batch, line, footer])) > 1900:
            result.append('\n'.join([header, *batch, footer]).strip())
            batch = []
        batch.append(line)
    result.append('\n'.join([header, *batch, footer]).strip())
    return result


def provenance(data):
    link = source_link(data.get('source'))
    state = ' · ⚠ 오래된 저장 기록' if data.get('stale') or data.get('refreshing') else ''
    return f'{clean(data.get("provider", "공식 기록"))}{state}\n조회: {clean(data.get("retrieved_at", "미확인"))}' + (f'\n출처: <{link}>' if link else '')


def session_pages(data):
    if data.get('state') == 'pending':
        return ['공식 세션 기록을 로딩 중입니다. 완료로 확인되지 않았습니다. 잠시 후 같은 명령으로 다시 조회해 주세요.']
    if data.get('state') != 'ready' or not data.get('rows'):
        return [data.get('message') or '게시된 세션 기록을 확인하지 못했습니다.']
    code = data['session']
    header = f'**F1 {data["season"]} R{data["round"]} · {clean(data["event"])} · {code}**'
    qualifier = '베스트랩으로 계산한 순서' if data.get('classification') == 'BEST_LAP_ORDER' else '게시된 세션 순위'
    lines = [qualifier + ' · 사후 판정으로 수정될 수 있음']
    for row in data['rows']:
        pos = row.get('position') or row.get('classified') or '—'
        who = f'{clean(pos)}. {clean(row.get("code") or row.get("name"))} · {clean(row.get("team"))}'
        if code in ('Q', 'SQ'):
            detail = ' · '.join(f'{part.upper()} {seconds(row.get(part))}' for part in ('q1', 'q2', 'q3'))
        elif code.startswith('FP'):
            detail = f'best {seconds(row.get("time_seconds"))}'
        else:
            detail = f'{clean(row.get("laps"))} laps · {clean(row.get("status"))} · {clean(row.get("points"))}점'
        classified = row.get('classified')
        if classified and not str(classified).isdigit():
            detail += f' · 분류 {clean(classified)}'
        lines.append(who + '\n' + detail)
    return pages(header, lines, provenance(data))


def standings_pages(data):
    if data.get('pending'):
        return ['챔피언십 순위를 준비 중입니다. 잠시 후 다시 조회해 주세요.']
    categories = [c for c in data.get('categories', []) if c.get('rows')]
    if not categories:
        return ['게시된 챔피언십 순위를 확인하지 못했습니다.']
    output = []
    for category in categories:
        header = f'**{clean(data.get("series", "F1")).upper()} {clean(data.get("season"))} · R{clean(data.get("round"))} · {clean(category.get("label", category.get("id")))}**'
        if data.get('classification'):
            header += '\n분류: ' + clean(data['classification'])
        lines = [f'{clean(r.get("position"))}. {clean(r.get("name"))} — {clean(r.get("points"))}점' for r in category['rows']]
        output.extend(pages(header, lines, provenance(data)))
    return output
