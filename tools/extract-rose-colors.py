#!/usr/bin/env python3
"""
장미 사진에서 블롭(말랑이) 색을 미리 뽑아 data/rose-colors.js 로 저장한다.

  내 컴퓨터에서 한 번 실행 (사이트에는 이 도구가 아니라 결과 파일만 쓰인다)
    data/rose-api.js 의 장미 사진 주소 (같은 이름은 하나로 합침 → 153종)
          ↓
    사진 내려받기  → ../private/rose-photos/ 에 보관 (공개 폴더 밖. 이미 있으면 다시 안 받음)
          ↓
    맥 기본 도구 sips 로 작게 줄여서(160px) 점 색을 읽음
          ↓
    꽃 부분만 고르기: 초록 잎·하늘·그늘·흐린 바닥색을 빼고, 이어진 가장 큰 꽃 덩어리 하나만
          ↓
    꽃 색을 세 무리로 나누고, 무리마다 "꽃 가장자리에서 얼마나 안쪽에 있나"를 잼
    (사진상 가운데가 아니라 가장자리 기준이라, 꽃이 비스듬히 찍혀도 맞게 나옴)
        안쪽(center)  가장 안쪽에 몰린 색
        바깥(outer)   나머지 중 가장 넓게 차지한 색
        끝(edge)      가장자리에 몰린 색, 바깥 색과 확실히 다를 때만
        수술(stamen)  가장 안쪽에 진한 노랑이 모여 있을 때만
          ↓
    data/rose-colors.js 로 저장  ← 사이트는 이 파일(색 숫자)만 읽는다

실행 방법 (project 0/site 폴더에서, 맥에서만 됨 — sips 사용):
    python3 tools/extract-rose-colors.py            전체 (처음엔 사진 받느라 3~4분)
    python3 tools/extract-rose-colors.py --only 에버골드,린   몇 개만 다시 계산해서 화면에 보여주기 (저장 안 함)

자동으로 뽑은 색이 사진과 다르면 아래 MANUAL 표에 손으로 고친 값을 적는다 (자동 값보다 우선).
"""
import colorsys
import json
import re
import struct
import subprocess
import sys
import tempfile
import time
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # project 0/site
PHOTO_DIR = ROOT.parent / 'private' / 'rose-photos'     # 사진 보관 (공개 안 됨)
OUT = ROOT / 'data' / 'rose-colors.js'
SIZE = 160          # 사진을 이 크기(긴 변, px)로 줄여서 계산
WAIT = 1.0          # 사진 한 장 받고 쉬는 시간(초) — 올림픽공원 사이트에 부담 안 주게

# 사람이 확인하고 고친 값 (자동 값보다 우선). 예: '에버골드': {'center': '#F2C14E', 'outer': '#F8E39A'}
#   None = 그 칸 지우기. 칠하는 방식(pattern):
#     없음(기본)  center 가운데 → outer 바깥 그라데이션 (+ edge 꽃잎 끝, stamen 수술)
#     'stripe'    꽃잎마다 base(바탕색) 위에 stripe(줄무늬 색)가 섞임 — 두 색이 반반 섞인 장미
MANUAL = {
    "핑크메이딜란드": {'center': '#F9D0D0', 'stamen': '#E8B040', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 흰빛 눈 + 노란 수술 추가
    "사티나": {'outer': '#E2B4C2', 'by': 'claude'},  # [2차 Claude] 그늘 때문에 탁한 자주로 잡힘 → 사진의 연분홍
    "콘첼티노": {'stamen': '#EFB33A', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 노란 수술 추가
    "핑크녹아웃": {'stamen': '#EFA62E', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 주황빛 노란 수술 추가
    "레드 메이딜란드": {'stamen': '#EFB33A', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 노란 수술 추가
    "니콜로파가니니": {'edge': None, 'by': 'claude'},  # [2차 Claude] 끝 색(회분홍)은 뒤쪽 붉은 잎이 섞인 것이라 없앰
    "스노우콘": {'center': '#F4F2EA', 'stamen': '#E8C040', 'by': 'claude'},  # [2차 Claude] 홑꽃: 안이 그늘진 회색으로 잡힘 → 흰빛, 노란 수술 추가
    "시에스타": {'center': '#F8E6EE', 'stamen': '#EFC040', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 흰 눈 + 노란 수술 추가
    "미라토": {'stamen': '#EFB33A', 'by': 'claude'},  # [2차 Claude] 가운데 노란 수술 추가 (수술이 작아 눈으로 고른 노랑)
    "크리스탈훼어리": {'center': '#F2EEE8', 'by': 'claude'},  # [2차 Claude] 안이 그늘진 회색으로 잡힘 → 흰빛
    "워터멜론아이스": {'center': '#F8E4EA', 'outer': '#E08AA4', 'stamen': '#EFC040', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 흰 눈 + 노란 수술 (안이 어두운 자주로 잡혔음)
    "블루밍 핑크": {'edge': None, 'by': 'claude'},  # [2차 Claude] 끝 색(회보라)은 뒤쪽 벽이 섞인 것이라 없앰
    "레드비즈": {'outer': '#C0143C', 'by': 'claude'},  # [2차 Claude] 밖이 바닥 자갈(크림색)로 잡힘 → 진한 빨강
    "메리데이": {'center': '#F2A85A', 'by': 'claude'},  # [2차 Claude] 안이 너무 진한 주황 → 사진의 살구빛 노랑
    "아이스 윙": {'center': '#F2DCD8', 'outer': '#F4F2F0', 'by': 'claude'},  # [2차 Claude] 그늘 때문에 파란 회색으로 잡힘 → 흰 장미, 안은 연한 분홍빛
    "킨렌포": {'center': '#F2E6A0', 'stamen': '#C8602A', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 주황빛 붉은 수술 추가, 안은 연노랑
    "시노부레도": {'center': '#9A6488', 'outer': '#B49AB2', 'by': 'claude'},  # [2차 Claude] 그늘 때문에 너무 진한 자주로 잡힘 → 사진의 연보라 회색빛
    "화이트 매직": {'center': '#EFE6D2', 'outer': '#F6F4F0', 'by': 'claude'},  # [2차 Claude] 사진이 어둡게 찍혀 회색으로 잡힘 → 흰 장미, 안은 크림빛
    "블랙 바카라": {'outer': '#B23468', 'by': 'claude'},  # [2차 Claude] 밖이 하늘(흰색)로 잡힘 → 짙은 와인 자주
    "녹아웃": {'stamen': '#EFB33A', 'by': 'claude'},  # [2차 Claude] 가운데 노란 수술 추가 (수술이 작아 눈으로 고른 노랑)
    "오렌지스플래쉬": {'pattern': 'stripe', 'base': '#FD6566', 'stripe': '#FCE8E4', 'center': None, 'outer': None, 'by': 'claude'},  # [2차 Claude] 산호·흰색 줄무늬 장미 → 줄무늬로
    "퍼플타이거": {'pattern': 'stripe', 'base': '#C8187E', 'stripe': '#F4DDEC', 'center': None, 'outer': None, 'by': 'claude'},  # [2차 Claude] 자주·흰색 줄무늬 장미 → 줄무늬로
    "코랄메이딜란드": {'stamen': '#EFB33A', 'by': 'claude'},  # [2차 Claude] 가운데 노란 수술 추가 (홑꽃, 수술이 작아 눈으로 고른 노랑)
    "기테드프랑스": {'stamen': '#EFB33A', 'by': 'claude'},  # [2차 Claude] 가운데 노란 수술 추가 (수술이 작아 뽑으면 올리브색이 돼서 눈으로 고른 노랑)
    "피스": {'edge': '#E2A4BC', 'by': 'claude'},  # [2차 Claude] 사진 꽃잎 끝 분홍 테두리 추가 (피스 장미의 특징)
    "골드리프": {'outer': '#E9CB32', 'by': 'claude'},  # [2차 Claude] 밖이 그늘진 황토색으로 잡힘 → 밝은 노랑
    "그라프레너트": {'edge': None, 'by': 'claude'},  # [2차 Claude] 끝 색(올리브)은 잎이 섞인 것이라 없앰
    "슈퍼 엑셀사": {'outer': '#D21C48', 'by': 'claude'},  # [2차 Claude] 밖이 하늘(흰색)로 잡힘 → 진홍 분홍
    "라위니아": {'center': '#B94240', 'outer': '#D9675E', 'by': 'claude'},  # [2차 Claude] 안이 흰 배경으로 잡힘 → 꽃 전체 산호 빨강 (안이 조금 진하게)
    "우아미": {'center': '#F2DAD6', 'by': 'claude'},  # [2차 Claude] 안이 그늘진 회색으로 잡힘 → 연한 살구 분홍
    "안젤라": {'center': '#F8D6E2', 'outer': '#ED81AB', 'stamen': '#E8C24A', 'by': 'claude'},  # [2차 Claude] 밖이 길바닥(흰색)으로 잡힘 → 밖 분홍, 가운데 흰 눈 + 노란 수술
    "아메리카": {'center': '#F56E66', 'outer': '#FC9A92', 'by': 'claude'},  # [2차 Claude] 밖이 길바닥(흰 회색)으로 잡힘 → 꽃 전체 산호빛, 안이 조금 진하게
    "드림위버": {'outer': '#F3A08F', 'by': 'claude'},  # [2차 Claude] 밖이 하늘·배경빛(거의 흰색)으로 잡힘 → 사진 꽃잎의 복숭아 분홍
    "카렌": {'pattern': 'stripe', 'base': '#FC5A66', 'stripe': '#FCEDE8', 'center': None, 'outer': None, 'by': 'claude'},  # [2차 Claude] 빨강·흰색 줄무늬 장미 → 줄무늬로 (맛쯔리와 같은 방식)
    "람피온": {'center': '#F7A8B5', 'stamen': '#F0C04A', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 흰빛 눈 + 노란 수술 (안이 진한 빨강으로 잡혔음)
    "코사이": {'center': '#E01A40', 'by': 'claude'},  # [2차 Claude] 안이 분홍으로 잡혔지만 사진은 꽃 전체가 빨강
    "함부르크 휘닉스": {'center': '#FCE4EC', 'outer': '#E61746', 'stamen': '#D9A866', 'by': 'claude'},  # [2차 Claude] 홑꽃: 가운데 흰 눈 + 노란 수술, 밖은 선명한 빨강
    "골든채피": {'center': '#F3EBA0', 'stamen': '#E1A119', 'by': 'claude'},  # [2차 Claude] 안 색이 주황 수술로 잡힘 → 안은 연노랑, 주황은 수술로
    "조지베스트": {'edge': None, 'by': 'claude'},  # [2차 Claude] 끝 색(갈색)은 시든 꽃잎·배경이 섞인 것이라 없앰
    "러블리훼어리": {'center': '#FCB4C4', 'stamen': '#F2B84F', 'by': 'claude'},  # [2차 Claude] 안 색이 노란 수술+분홍이 섞인 황토색 → 안은 연분홍, 노랑은 수술로
    "히나아라레": {'center': '#FAF2EE', 'stamen': '#E6B63C', 'by': 'claude'},  # [2차 Claude] 안 색이 노란 수술로 잡힘 → 안은 흰빛, 노랑은 수술로
    "루지로얄": {'edge': None},  # 끝 색은 잎(올리브 초록)이 섞인 것이라 없앰
    "아스트리드그라핀폰하덴베르그": {'center': '#B8234A', 'outer': '#D2406A'},  # 밖이 하늘색(흰)으로 잘못 잡힘 → 꽃 전체 와인빛: 안 진한 와인, 밖 와인 분홍
    "칵테일": {'center': '#FCF1EE', 'stamen': '#F8C547'},  # 홑꽃: 가운데 흰 바탕 + 노란 수술, 밖은 진분홍 그대로
    "핑크 스와니": {'stamen': '#EFA62E'},  # 가운데 주황빛 노란 수술 추가
    "오렌지 메이안디나": {'edge': None, 'stamen': '#2B1E1E'},  # 끝 색은 배경 흰 벽이 섞인 것이라 없앰, 가운데 수술은 검은색
    "캐롤라인드모나코": {'stamen': '#F8BDB8'},  # 가운데가 노랑이 아니라 연한 분홍빛
    "스위트멜리나": {'center': '#FBA2C4', 'outer': '#FD6490'},  # 안이 연하고 밖이 진함 → 안·밖 반대
    "벨라 아로마": {'edge': '#E293B9'},  # 꽃잎 끝 분홍 테두리 (사진 가장자리 분홍만 모아 뽑음)
    "라벤더 드림": {'center': '#F0C850', 'outer': '#E89AB5'},  # 여러 송이가 붙어 찍힘. 가운데 노란 수술 인상을 살려 안=노랑, 밖=분홍
    "리오삼바": {'edge': '#F5B4AE'},  # 꽃잎 끝 연한 분홍 추가 (안·밖은 자동 값 그대로)
    "탄초": {'center': '#F6A8B4', 'outer': '#F6A8B4', 'edge': '#F96069'},  # 안·밖은 (자동)안 색, 끝은 (자동)밖 색
    "찰스톤": {'center': '#F8C98E', 'outer': '#F2B0A2', 'edge': '#E8708A'},  # 안은 노란 크림, 밖은 복숭아 분홍, 꽃잎 끝은 진한 분홍
    "맛쯔리": {'pattern': 'stripe', 'base': '#F6363D', 'stripe': '#FBE6C8', 'center': None, 'outer': None, 'edge': None},  # 코랄 빨강에 크림 줄무늬
    "쿠로초": {'center': '#F73B67', 'outer': '#D71233', 'edge': None},  # 끝 색은 덜 피거나 시든 부분이라 없앰, 안·밖 반대
}


def apply_manual(colors, fix):
    """손으로 고친 값 적용. 값이 None이면 그 칸을 지움 (예: 'edge': None → 꽃잎 끝 색 없음)"""
    for k, v in fix.items():
        if v is None:
            colors.pop(k, None)
        else:
            colors[k] = v
    colors.pop('mono', None)
    colors['manual'] = True


# ---------- 데이터 읽기 + 같은 이름 합치기 (js/adapters/roseAdapter.js 의 roseDedupe 와 같은 규칙) ----------
def load_roses():
    text = (ROOT / 'data' / 'rose-api.js').read_text(encoding='utf-8')
    items = json.loads(text[text.index('window.ROSE_API = ') + len('window.ROSE_API = '):].strip().rstrip(';'))

    def list_no(it):
        m = re.search(r'list_no=(\d+)', it.get('url') or '')
        return int(m.group(1)) if m else 0

    best = {}
    for it in items:
        key = (it.get('title') or '').strip()
        prev = best.get(key)
        longer = prev and len(it.get('description') or '') - len(prev.get('description') or '')
        if not prev or longer > 0 or (longer == 0 and list_no(it) > list_no(prev)):
            best[key] = it
    return [(name, it.get('url'), list_no(it)) for name, it in best.items()]


# ---------- 사진 받기 ----------
def photo_path(url, no):
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    path = PHOTO_DIR / f'{no}.jpg'
    if path.exists() and path.stat().st_size > 1000:
        return path, False
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (rose color tool)'})
    with urllib.request.urlopen(req, timeout=30) as res:
        path.write_bytes(res.read())
    return path, True


# ---------- 사진 → 점 색 목록 (sips 로 줄여서 BMP 로 바꾼 뒤 직접 읽음) ----------
def read_pixels(path):
    with tempfile.TemporaryDirectory() as tmp:
        bmp = Path(tmp) / 'p.bmp'
        subprocess.run(['sips', '-Z', str(SIZE), '-s', 'format', 'bmp', str(path), '--out', str(bmp)],
                       check=True, capture_output=True)
        data = bmp.read_bytes()
    offset = struct.unpack_from('<I', data, 10)[0]
    w, h = struct.unpack_from('<ii', data, 18)
    bpp = struct.unpack_from('<H', data, 28)[0]
    step = bpp // 8
    row = (w * step + 3) // 4 * 4
    flip = h > 0
    h = abs(h)
    px = []
    for y in range(h):
        base = offset + (h - 1 - y if flip else y) * row
        for x in range(w):
            b, g, r = data[base + x * step: base + x * step + 3]
            px.append((x, y, r, g, b))
    return w, h, px


# ---------- 꽃 색인지 판단 ----------
def is_flower(r, g, b):
    """꽃잎일 수 있는 색인가. 꽃잎은 '진한 색'이거나 '아주 밝은 흰·크림색'이다.
    어중간하게 흐린 베이지·회색(자갈, 나무껍질 바닥, 돌)은 뺀다."""
    hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    hue = hh * 360
    if v < 0.25:                                   # 너무 어두움 = 그늘·배경
        return False
    if 70 <= hue <= 175 and s > 0.12:              # 초록 잎·풀
        return False
    if 175 < hue < 265 and s > 0.12:               # 하늘·파란 배경
        return False
    if 15 <= hue <= 48 and v < 0.70:                # 갈색 = 나무껍질·흙 바닥 (주황·노랑 꽃잎은 이보다 밝음)
        return False
    if s >= 0.33:                                  # 진한 색 꽃잎 (빨강·분홍·노랑·주황·보라)
        return True
    return v >= 0.80                               # 흰·크림 꽃잎 (흐린 바닥색은 여기서 빠짐)


def main_blob(w, h, mask):
    """꽃 점들 중 서로 이어진 덩어리를 찾아, '크고 + 사진 가운데에 가까운' 덩어리 하나를 고른다.
    배경에 작게 찍힌 다른 장미나 흩어진 점은 빠진다."""
    seen = [False] * (w * h)
    best, best_score = None, 0
    for start in range(w * h):
        if not mask[start] or seen[start]:
            continue
        stack, comp = [start], []
        seen[start] = True
        while stack:
            i = stack.pop()
            comp.append(i)
            x, y = i % w, i // w
            for j in (i - 1 if x > 0 else -1, i + 1 if x < w - 1 else -1, i - w if y > 0 else -1, i + w if y < h - 1 else -1):
                if j >= 0 and mask[j] and not seen[j]:
                    seen[j] = True
                    stack.append(j)
        mx = sum(i % w for i in comp) / len(comp) / w - 0.5
        my = sum(i // w for i in comp) / len(comp) / h - 0.5
        score = len(comp) * (1.2 - (mx * mx + my * my) ** 0.5)
        if score > best_score:
            best, best_score = comp, score
    return best or []


def hexof(c):
    return '#%02X%02X%02X' % tuple(max(0, min(255, round(v))) for v in c)


def dist(a, b):
    # 사람 눈 기준 대략적인 색 차이 (빨강·초록·파랑 가중치)
    return ((2 * (a[0] - b[0]) ** 2) + (4 * (a[1] - b[1]) ** 2) + (3 * (a[2] - b[2]) ** 2)) ** 0.5 / 3


def rep_color(pixels):
    """구역의 대표 색: 밝기 순으로 줄 세워 그늘(어두운 쪽 35%)과 반사광(밝은 쪽 8%)을 빼고 평균"""
    if len(pixels) < 12:
        return None
    srt = sorted(pixels, key=lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2])
    part = srt[int(len(srt) * 0.35): max(int(len(srt) * 0.92), int(len(srt) * 0.35) + 1)]
    return tuple(sum(p[i] for p in part) / len(part) for i in range(3))


def edge_depth(w, h, blob_set):
    """꽃 덩어리의 각 점이 가장자리에서 몇 칸 안쪽인지 (가장자리 = 0). 0~1로 맞춰서 돌려줌"""
    depth = {}
    frontier = [i for i in blob_set if any(
        j not in blob_set for j in ((i - 1) if i % w else -1, (i + 1) if i % w < w - 1 else -1, i - w, i + w))]
    for i in frontier:
        depth[i] = 0
    d = 0
    while frontier:
        d += 1
        nxt = []
        for i in frontier:
            x = i % w
            for j in ((i - 1) if x > 0 else -1, (i + 1) if x < w - 1 else -1, i - w, i + w):
                if j in blob_set and j not in depth:
                    depth[j] = d
                    nxt.append(j)
        frontier = nxt
    top = max(depth.values()) or 1
    return {i: v / top for i, v in depth.items()}


def chroma(c):
    """색의 '종류'만 남긴 값: 밝기는 거의 무시 (그늘진 분홍과 밝은 분홍을 같은 색으로 봄)"""
    t = sum(c) + 1
    return (c[0] / t * 300, c[1] / t * 300, c[2] / t * 300, (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) * 0.15)


def kmeans(colors, k=3, rounds=15):
    """꽃 색을 k개 무리로 나눔. 밝기가 아니라 색의 종류(빨강·노랑·흰색…)로 나눠서 그늘이 따로 무리 짓지 않게"""
    feats = [chroma(c) for c in colors]
    d2 = lambda a, b: sum((x - y) ** 2 for x, y in zip(a, b))
    # 처음 대표: 서로 가장 멀리 떨어진 색들로 (k-means++ 비슷하게, 늘 같은 결과가 나오게 결정적으로)
    cents = [feats[len(feats) // 2]]
    while len(cents) < k:
        cents.append(max(feats, key=lambda f: min(d2(f, c) for c in cents)))
    for _ in range(rounds):
        labels = [min(range(k), key=lambda g: d2(f, cents[g])) for f in feats]
        for g in range(k):
            mem = [feats[n] for n, l in enumerate(labels) if l == g]
            if mem:
                cents[g] = tuple(sum(f[i] for f in mem) / len(mem) for i in range(4))
    labels = [min(range(k), key=lambda g: d2(f, cents[g])) for f in feats]
    return cents, labels


def analyze(path):
    w, h, px = read_pixels(path)
    mask = [is_flower(r, g, b) for _, _, r, g, b in px]
    blob = main_blob(w, h, mask)
    if len(blob) < 80:
        return None, len(blob) / len(px)
    blob_set = set(blob)
    depth = edge_depth(w, h, blob_set)
    colors = [(px[i][2], px[i][3], px[i][4]) for i in blob]

    # 꽃 색을 세 무리로 나누고, 무리마다 "얼마나 많은가(share)"와 "얼마나 안쪽에 있나(inner)"를 잼
    cents, labels = kmeans(colors, 3)
    groups = []
    for g in range(3):
        members = [n for n, l in enumerate(labels) if l == g]
        if len(members) / len(blob) < 0.08:          # 너무 적은 무리(반사광·티끌)는 무시
            continue
        groups.append({
            'color': rep_color([colors[n] for n in members]),
            'share': len(members) / len(blob),
            'inner': sum(depth[blob[n]] for n in members) / len(members),
        })
    groups.sort(key=lambda g: g['inner'])           # 가장자리 쪽 → 안쪽 순서

    center_g = groups[-1]                           # 가장 안쪽에 몰린 색 = 가운데
    rest = [g for g in groups if g is not center_g]
    edge_g = groups[0] if len(groups) >= 2 else None  # 가장 가장자리에 몰린 색 = 꽃잎 끝 후보
    outer_g = max(rest, key=lambda g: g['share']) if rest else center_g

    out = {'center': hexof(center_g['color']), 'outer': hexof(outer_g['color'])}
    if (edge_g and edge_g is not outer_g and edge_g['share'] >= 0.1
            and dist(edge_g['color'], outer_g['color']) > 55 and outer_g['inner'] - edge_g['inner'] > 0.08):
        out['edge'] = hexof(edge_g['color'])
    if dist(center_g['color'], outer_g['color']) < 14:
        out['center'] = hexof(tuple(v * 0.88 for v in outer_g['color']))
        out['mono'] = True

    # 수술: 가장 안쪽(깊이 0.6 이상)에 진한 노랑이 모여 있고 꽃잎 색과 다르면
    deep = [c for i, c in zip(blob, colors) if depth[i] > 0.6]
    yellow = [c for c in deep if 35 <= colorsys.rgb_to_hsv(*(v / 255 for v in c))[0] * 360 <= 62
              and colorsys.rgb_to_hsv(*(v / 255 for v in c))[1] > 0.45]
    if deep and 0.08 < len(yellow) / len(deep) < 0.6:
        yc = rep_color(yellow)
        if yc and dist(yc, outer_g['color']) > 45 and dist(yc, center_g['color']) > 30:
            out['stamen'] = hexof(yc)
    return out, len(blob) / len(px)


def main():
    only = None
    if '--only' in sys.argv:
        only = set(sys.argv[sys.argv.index('--only') + 1].split(','))
    roses = load_roses()
    if only:
        roses = [r for r in roses if r[0] in only]
    result, problems = {}, []
    for i, (name, url, no) in enumerate(roses, 1):
        try:
            path, fresh = photo_path(url, no)
            if fresh:
                time.sleep(WAIT)
            colors, flower_ratio = analyze(path)
        except Exception as e:                       # 사진을 못 받거나 못 읽으면 건너뜀 (블롭은 기본 색)
            problems.append(f'{name}: {e}')
            continue
        if colors is None:
            problems.append(f'{name}: 꽃 색을 찾지 못함 (꽃 비율 {flower_ratio:.0%})')
            continue
        colors['photo'] = no
        if flower_ratio < 0.08:
            colors['check'] = True                   # 꽃이 사진에서 작게 나옴 → 눈으로 확인 필요
        if name in MANUAL:
            apply_manual(colors, MANUAL[name])
        result[name] = colors
        print(f'[{i}/{len(roses)}] {name}: {colors}')

    if problems:
        print('\n확인 필요:\n  ' + '\n  '.join(problems))
    if only:
        print('\n(--only: 저장하지 않음)')
        return
    body = json.dumps(result, ensure_ascii=False, indent=1)
    OUT.write_text(
        '// 자동 생성 파일 — 직접 고치지 마세요. 다시 만들려면: python3 tools/extract-rose-colors.py\n'
        '// 장미 사진에서 뽑은 블롭 색 (center 안쪽, outer 바깥, edge 꽃잎 끝, stamen 수술). 사진 자체는 들어 있지 않음.\n'
        f'// 만든 날짜: {date.today().isoformat()} · 출처 사진: 올림픽공원 장미정보 API (url)\n'
        f'window.ROSE_COLORS = {body};\n', encoding='utf-8')
    print(f'\n저장: {OUT.relative_to(ROOT)} ({len(result)}종)')


if __name__ == '__main__':
    main()
