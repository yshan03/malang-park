#!/usr/bin/env python3
"""
장미정보 API에서 전체 데이터를 받아 data/rose-api.js 로 저장한다.

  내 컴퓨터에서 한 번 실행
    js/config.local.js 에서 키 읽기
          ↓
    API를 페이지별로 호출 (100건씩)
          ↓
    data/rose-api.js 로 저장  ← 사이트는 이 파일만 읽는다 (키는 사이트에 안 들어감)

실행 방법 (project 0 폴더에서):
    python3 tools/fetch-roses.py            전체 받아서 저장
    python3 tools/fetch-roses.py --peek     3건만 받아서 화면에 보여주기 (저장 안 함)
"""
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENDPOINT = 'https://api.kcisa.kr/openapi/service/rest/meta13/getKSCD0801'
PAGE_SIZE = 100


def read_key():
    path = ROOT / 'js' / 'config.local.js'
    if not path.exists():
        sys.exit('js/config.local.js 파일이 없어요. config.local.example.js를 복사해서 키를 넣어 주세요.')
    m = re.search(r"API_KEY\s*=\s*['\"]([^'\"]+)['\"]", path.read_text(encoding='utf-8'))
    if not m or '여기에' in m.group(1):
        sys.exit('config.local.js 안에 인증키가 들어 있지 않아요.')
    return m.group(1).strip()


def fetch_page(key, page, rows):
    # 키가 이미 %로 인코딩된 형태면 그대로, 아니면 인코딩해서 붙인다
    key_part = key if '%' in key else urllib.parse.quote(key, safe='')
    url = f'{ENDPOINT}?serviceKey={key_part}&numOfRows={rows}&pageNo={page}'
    with urllib.request.urlopen(url, timeout=20) as res:
        text = res.read().decode('utf-8')
    root = ET.fromstring(text)
    code = root.findtext('.//resultCode')
    if code not in (None, '00', '0000'):
        msg = root.findtext('.//resultMsg') or text[:300]
        sys.exit(f'API 오류 (resultCode={code}): {msg}')
    if root.find('.//items') is None and root.find('.//item') is None:
        sys.exit('예상과 다른 응답이에요:\n' + text[:500])
    items = [{child.tag: (child.text or '').strip() for child in item} for item in root.iter('item')]
    total = root.findtext('.//totalCount')
    return items, int(total) if total and total.isdigit() else None


def main():
    key = read_key()

    if '--peek' in sys.argv:
        items, total = fetch_page(key, 1, 3)
        print(f'전체 건수: {total}')
        print(json.dumps(items, ensure_ascii=False, indent=2))
        return

    all_items, page, total = [], 1, None
    while True:
        items, total = fetch_page(key, page, PAGE_SIZE)
        all_items += items
        print(f'{page}페이지: {len(items)}건 (누적 {len(all_items)} / 전체 {total})')
        if not items or (total and len(all_items) >= total) or len(items) < PAGE_SIZE:
            break
        page += 1

    out = ROOT / 'data' / 'rose-api.js'
    body = json.dumps(all_items, ensure_ascii=False, indent=2)
    out.write_text(
        '// 자동 생성 파일 — 직접 고치지 마세요. 다시 받으려면: python3 tools/fetch-roses.py\n'
        f'// 출처: 한국체육산업개발(주) 올림픽공원 장미정보 API · 받은 날짜: {date.today().isoformat()}\n'
        f'window.ROSE_API_FETCHED = "{date.today().isoformat()}";\n'
        f'window.ROSE_API = {body};\n',
        encoding='utf-8')
    print(f'저장 완료: data/rose-api.js ({len(all_items)}건)')


if __name__ == '__main__':
    main()
