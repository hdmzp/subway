# 노인 무임승차와 지하철 적자 실증 분석 프로젝트

성균관대학교 데이터사이언스융합학과 석사과정 26-1학기
데이터분석언어 프로젝트 「노인 무임승차와 지하철 적자 실증 분석」결과를 소개하는 정적 웹사이트입니다.

- `index.html` — 사이트 본문 (개요 → 데이터·방법 → 기초 현황 → 가설 1·2 → 자치구 지도 → 결론·정책 제언)
- `assets/app.js` — 순수 SVG/JS 인터랙티브 차트 및 서울 자치구 코로플레스 지도 (외부 라이브러리 없음)
- `assets/seoul_gu.js` — 서울 25개 자치구 경계 데이터 (GeoJSON 기반)
- `assets/style.css` — 스타일 (라이트/다크 모드 지원)

## 로컬에서 보기

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

## 활용 데이터

- [활용 데이터 폴더 (Google Drive)](https://drive.google.com/drive/folders/1Ba-_rPPzTqO3zJAV6_XWIf-IUYFGFoRt)
- 서울 열린데이터광장 · 공공데이터포털 · KOSIS · 서울교통공사 재무제표
