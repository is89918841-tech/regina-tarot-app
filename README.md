# Regina Divination Platform

AGENTS.md 요구사항을 반영한 기본 프로젝트 스캐폴드입니다.

## 구성

- `POST /api/reading/generate`: 질문 + 스프레드 + 덱 기반 리딩 생성
- `POST /api/admin/upload`: 관리자 지식 파일 업로드(PDF/TXT/DOCX 등)
- `GET /api/admin/files`: 파일 목록 조회
- `PATCH /api/admin/files/:id`: 메타데이터 수정
- `DELETE /api/admin/files/:id`: 파일 삭제
- `/admin`: 관리자 대시보드
- `/`: 리딩 생성 UI

## 실행

```bash
npm install
npm start
```

## 환경변수

- `PORT` (기본 3000)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (기본 `gpt-4.1-mini`)
- `OPENAI_VECTOR_STORE_ID`
- `ADMIN_TOKEN` (관리자 API 보호)
- `UPLOAD_PATH` (기본 `/data/uploads`, Render persistent disk 권장)
- `METADATA_STORE_PATH` (기본 `/data/uploads/metadata.json`)

## 보안

- 관리자 API는 `x-admin-token` 헤더가 필요합니다.
- API 키는 코드에 하드코딩하지 않고 환경변수만 사용합니다.

## 지식 우선순위

리딩 전 지식 검색 우선순위:

1. tone/rule + core
2. deck 일치 자료
3. topic 일치 자료
4. 일반 reference

