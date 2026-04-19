# 상담 상품명/가격 분리 구조 제안

현재 공개 상담 페이지는 `/data/consultation-products.json` 파일을 먼저 읽고, 실패 시 내장 fallback 데이터를 사용합니다.

## 현재 반영된 구조
- 공개 페이지 데이터 소스: `public/data/consultation-products.json`
- 페이지 로딩 시 해당 JSON을 fetch 하여 메뉴/가격을 렌더링
- JSON만 수정하면 코드 수정 없이 메뉴/가격 변경 가능

## 관리자 연동 확장 제안 (다음 단계)
1. `GET /api/admin/consultation-products` (adminAuth)
2. `PUT /api/admin/consultation-products` (adminAuth)
3. 관리자 페이지(`public/admin.html`)에 상품명/가격 편집 UI 추가
4. 서버에서 JSON 파일 저장 시 스키마 검증(id/title/price/desc/rec 필수)
5. 저장 이력(변경자/변경일) 기록

이 구조면 운영 중 가격/상품명 변경을 코드 배포 없이 관리자 페이지에서 반영할 수 있습니다.
