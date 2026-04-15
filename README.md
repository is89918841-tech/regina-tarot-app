# Regina Divination Platform

Regina 스타일의 구조화된 타로 리딩을 생성하고, 관리자 전용 지식 업로드/검색을 운영하는 Express 기반 서비스입니다.

## 아키텍처

- `src/app.js`: Express 앱, 라우팅/정적 파일/에러 처리
- `src/routes/readingRoutes.js`: 리딩 API
- `src/routes/adminRoutes.js`: 관리자 파일 업로드/목록/수정/삭제 API
- `src/services/readingService.js`: 의도 분석 + Regina 프롬프트 + 생성
- `src/services/knowledgeService.js`: 파일 인덱싱/벡터스토어 등록/처리상태 추적/검색
- `src/config/env.js`: 런타임 설정
- `src/utils/*`: 파일 저장/멀티파트 파싱 유틸

## API

### Reading API

`POST /api/reading/generate`

```json
{
  "question": "이번 이직이 맞을까요?",
  "spread": ["현재", "장애물", "조언"],
  "deck": "나전의 빛 타로",
  "topic": "이직"
}
```

### Admin API (x-admin-token 필수)

- `POST /api/admin/upload` (`multipart/form-data`)
  - 필수: `file`
  - 선택: `deck`, `topic`, `priority(core|support|optional)`, `type(guidebook|interpretation|tone|rule)`
- `GET /api/admin/files`
- `PATCH /api/admin/files/:id`
- `DELETE /api/admin/files/:id`

## 벡터스토어 처리 상태 로직

업로드 시 상태가 아래처럼 전이됩니다.

1. `saved` (로컬 저장)
2. `uploaded` (OpenAI file 업로드 완료)
3. `processing` (vector store 파일 처리 대기/진행)
4. `processed` (vector processing 완료)
5. `error` (실패)

`VECTOR_PROCESSING_TIMEOUT_MS` 동안 polling 하며 완료 여부를 확인합니다.

## 환경변수

- `PORT` (기본: `3000`)
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (기본: `gpt-4.1-mini`)
- `OPENAI_VECTOR_STORE_ID`
- `ADMIN_TOKEN` (필수)
- `UPLOAD_PATH` (기본: `/data/uploads`)
- `METADATA_STORE_PATH` (기본: `/data/uploads/metadata.json`)
- `MAX_UPLOAD_SIZE_MB` (기본: `100`)
- `VECTOR_PROCESSING_TIMEOUT_MS` (기본: `180000`)
- `VECTOR_PROCESSING_POLL_MS` (기본: `3000`)

## 로컬 실행

```bash
npm install
npm start
```

## Render 배포 가이드

### 1) 서비스 생성

- Render에서 **Web Service** 생성
- Start command: `npm start`
- Node 버전은 Render 기본 최신 LTS 사용 권장

### 2) Persistent Disk 연결

- Render Dashboard > Service > **Disks** > Add Disk
- Mount path를 `/data`로 설정
- `UPLOAD_PATH=/data/uploads` 설정
- `METADATA_STORE_PATH=/data/uploads/metadata.json` 설정

### 3) 환경변수 설정

Render > Environment:

- `OPENAI_API_KEY`
- `OPENAI_VECTOR_STORE_ID`
- `ADMIN_TOKEN`
- `UPLOAD_PATH=/data/uploads`
- `MAX_UPLOAD_SIZE_MB=100` (또는 운영 정책에 맞게 조정)

### 4) Vector Store 준비

- OpenAI 플랫폼에서 vector store를 생성
- 생성된 ID를 `OPENAI_VECTOR_STORE_ID`로 설정
- 관리자 페이지(`/admin`)에서 파일 업로드 후 상태가 `processed`인지 확인

## 운영 팁

- 대용량 PDF 업로드 시 처리 시간이 길어질 수 있으므로 timeout/poll 값을 환경에 맞게 조정하세요.
- 관리자 토큰은 강력한 랜덤 문자열을 사용하고 정기적으로 교체하세요.
- `UPLOAD_PATH`는 반드시 persistent disk 경로를 사용하세요.
