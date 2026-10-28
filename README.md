# 놀탭 NOLTAP — 웹게임과 재미 도구

게임과 심심풀이·실용 도구를 모아 운영하는 놀탭(NOLTAP) 웹 포털입니다. 현재 **누르지 마!**, **PARRY: LAST BLADE**, **통통! 해적 룰렛**을 플레이할 수 있습니다. 포털은 `index.html`, 각 게임은 `parry.html`과 `pirate.html`에서 제공하며, 게임 화면·진행 로직·랭킹 API를 분리해 관리합니다.

프런트엔드는 Vite 정적 빌드로 배포합니다. **누르지 마!**와 **PARRY**의 온라인 랭킹은 Hostinger의 PHP 8.2 이상과 MySQL/MariaDB를 사용합니다. **통통! 해적 룰렛**은 한 기기에서 2~8명이 함께 하며 게임과 기록은 브라우저에서 처리합니다. DB는 사용하지 않고, 운영 사이트에서는 PHP 엔드포인트로 공개 3D 모델을 전달합니다. 세 게임의 진행 로직은 화면 코드와 분리되어 있습니다. PARRY와 해적 룰렛은 Three.js로 만든 3D 장면을 사용합니다.

## 로컬 실행

Node.js를 설치한 뒤 프로젝트 폴더에서 실행합니다.

```bash
npm install
npm run dev
```

각 게임 엔진 규칙을 확인하려면 `npm test`를 실행합니다. 배포 번들은 `npm run build`로 생성합니다.

랭킹 API까지 로컬에서 확인하려면 PHP 8.1 이상과 `pdo_mysql`이 필요합니다. `public/api/config.example.php`를 `public/api/config.php`로 복사한 뒤 개발용 DB 접속 정보를 입력하고 터미널 두 개에서 실행합니다.

```bash
php -S 127.0.0.1:8000 -t public
```

```bash
npm run dev
```

Vite 개발 서버는 `/api` 요청을 PHP 개발 서버로 전달합니다. DB가 설정되지 않으면 누르지 마!와 PARRY의 서버 랭킹은 비활성화되고 두 게임은 로컬 기록으로 실행됩니다. 해적 룰렛의 로컬·GitHub Pages 미리보기는 GLB를 직접 불러옵니다. 운영 도메인(noltap.com)에서는 `api/pirate-model.php`가 공개 모델 세 개를 전달하며 DB 설정은 필요하지 않습니다.

## GitHub Pages 미리보기

GitHub 저장소의 **Settings → Pages → Build and deployment → Source**에서 `GitHub Actions`를 선택하면 `.github/workflows/pages.yml`이 `main`에 올라올 때마다 정적 미리보기를 빌드하고 배포합니다. 공개 주소는 `https://hok-98.github.io/noltap/`입니다.

미리보기 빌드는 `/noltap/` 경로와 일치하도록 자산 경로를 맞추고 PHP API 파일을 제외합니다. 누르지 마!와 PARRY는 로컬 모드로 플레이할 수 있으며, 온라인 랭킹은 표시되지 않습니다. 개인 기록은 해당 브라우저에 저장됩니다. 전체 랭킹 기능은 Hostinger의 `https://noltap.com/`에서 사용할 수 있습니다.

## DB 만들기

1. Hostinger hPanel에서 MySQL 데이터베이스와 사용자를 만들고 해당 사용자에게 DB 권한을 부여합니다.
2. phpMyAdmin에서 새 DB를 선택합니다.
3. `database/schema.sql`을 가져오거나 SQL 탭에 붙여 넣어 실행합니다.
4. DB 호스트·이름·사용자·비밀번호를 기록합니다. Hostinger가 제시한 값을 사용하세요. 호스트는 보통 `localhost`지만 계정 설정에 따라 다를 수 있습니다.

이전 버전에서 만든 DB를 계속 쓸 경우 새 스키마를 다시 만들지 말고 `database/migrate-v2.sql`을 한 번 실행하세요. `database/schema.sql` 또는 필요한 이전 마이그레이션까지 적용한 뒤 `database/parry-v1.sql`을 한 번 실행하세요. 이 파일은 PARRY 전용 테이블만 추가해 누르지 마! 기록과 익명 플레이어 식별자를 유지합니다.

기본 스키마에는 익명 플레이어, 날짜별 공통 도전 시드, 누르지 마! 기록, API 요청 제한 테이블이 있습니다. PARRY SQL을 추가 실행하면 전용 세션·기록·오늘의 시드 테이블이 더해집니다. 닉네임은 익명 플레이어 식별자에 연결되며, 닉네임만 입력해서 다른 플레이어의 기록을 바꿀 수 없습니다.

## PHP API 설정

배포 시 DB 비밀번호를 소스 저장소에 넣지 마세요. 빌드한 뒤 Hostinger File Manager에서 `public_html/api/config.example.php`를 복사해 `config.php`로 만들고 값을 채웁니다.

```php
return [
    'db_host' => 'Hostinger에서 안내한 DB 호스트',
    'db_name' => '데이터베이스 이름',
    'db_user' => '데이터베이스 사용자',
    'db_password' => '데이터베이스 비밀번호',
    'app_secret' => '충분히 긴 임의의 비밀 문자열',
];
```

비밀 문자열은 48자 이상으로 설정하세요. 서버 터미널에서 PHP를 사용할 수 있다면 `php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"`로 생성할 수 있습니다. `config.php`와 `lib.php`의 직접 웹 접근은 `public/api/.htaccess`가 막습니다.

## Hostinger 배포

1. 로컬 프로젝트에서 배포 파일을 만듭니다.

   ```bash
   npm install
   npm run build
   ```

2. `dist` 폴더 안의 **내용물 전체**를 Hostinger의 `public_html`에 업로드합니다. 폴더 자체가 아니라 `index.html`, `parry.html`, `pirate.html`, `assets/`, `models/`, `api/`, `.htaccess`가 `public_html` 바로 아래에 오도록 합니다. PARRY의 `models/parry-knight.glb` 또는 해적 룰렛의 `models/barrel.glb`, `models/pirate.glb`, `models/knife.glb`가 빠지면 해당 3D 게임 장면을 불러올 수 없습니다.
3. `public_html/api/config.example.php`를 복사해 `public_html/api/config.php`를 만들고 DB 접속 값을 입력합니다.
4. `database/parry-v1.sql`을 실행했는지 확인한 뒤 사이트와 `/parry.html`을 열어 랭킹 연결을 확인합니다.

Node.js 서버는 운영에 필요하지 않습니다. PHP 8.2 이상이 활성화되어 있고 PDO MySQL 확장이 제공되어야 랭킹 API가 동작합니다. 새 Hostinger 사이트는 PHP 8.3이 기본이며, 현재 PHP 설정에서 8.2 이상 버전을 선택할 수 있습니다. 새 버전을 올릴 때는 `dist` 파일을 다시 업로드한 뒤 `api/config.php`도 존재하는지 확인하세요. 새 빌드 파일에는 실제 DB 비밀번호를 넣지 않습니다.

Hostinger의 최신 절차는 [File Manager 안내](https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/), [phpMyAdmin SQL 가져오기](https://www.hostinger.com/support/1884149-how-to-import-a-database-with-phpmyadmin-in-hostinger/), [PHP 버전 설정](https://www.hostinger.com/support/1575755-how-to-change-the-php-version-of-your-hosting-plan/)에서 확인할 수 있습니다. Hostinger는 Web·Cloud 호스팅에서 PDO와 `pdo_mysql`을 지원한다고 안내합니다.

## 누르지 마! 게임 규칙과 점수

- 영어 단어 `RED`, `BLUE`, `GREEN`, `YELLOW`의 **뜻은 무시하고 실제 글자색**을 아래 네 버튼에서 선택합니다.
- 버튼은 빨강/파랑, 초록/노랑 순서로 고정됩니다. 키보드 `1`–`4`, 마우스, 모바일 터치를 지원합니다.
- 생명은 3개이며, 오답이나 시간 초과마다 1개를 잃습니다. 생명이 0이 되면 게임이 끝납니다.
- 문제는 무한 생성되고 5문제마다 스테이지가 올라갑니다. 정답·오답·시간 초과 뒤 다음 문제가 바로 표시됩니다.
- 제한시간은 1번 문제 3,000ms에서 시작해 3문제마다 100ms씩 줄어듭니다. 최저 1,000ms이며, 61번 문제부터 유지됩니다.
- 31번 문제부터 정답 버튼은 모두 같은 무채색으로 표시되며 RED·BLUE·GREEN·YELLOW 색상 이름만 보고 선택합니다. 1–30번은 기존 색 버튼을 유지합니다. 재시작하면 색 버튼으로 돌아갑니다.
- 1–30번 문제는 기본 다크 배경입니다. 31번부터 매 문제마다 배경색이 바뀌며, 정답인 실제 글자색과 단어가 뜻하는 색 둘 다와 겹치지 않습니다. 배경은 정답 판정에 영향을 주지 않습니다.
- 이 규칙은 랭킹 검증에서 규칙 버전 3으로 저장됩니다. 기존 버전 2 기록은 보존되지만 새 규칙 기록과 랭킹을 섞지 않습니다. 이미 v2 스키마를 적용한 DB에는 추가 SQL 변경이 필요하지 않습니다.
- 정답 점수는 기본 100점 + 제한시간 기준 속도 보너스(최대 100점) + 연속 정답 콤보 보너스(최대 50점)입니다. 속도 보너스는 `floor(100 × (1 - reactionMs / limitMs))`입니다.
- 평균·최고 반응속도는 정답 응답만 사용합니다. 시간 초과는 제한시간 만료 시 한 번만 처리됩니다.
- 랭킹은 처리한 문제 수, 점수, 정확도, 기록 시각 순으로 정렬합니다. 오늘의 도전은 KST 날짜별 같은 시드와 문제 순서를 사용하고 날짜별 최고 기록을 반영합니다.

반응시간은 단어가 화면에 표시된 프레임부터 `performance.now()`로 측정합니다. 브라우저·화면·입력 장치의 지연이 결과에 영향을 줄 수 있습니다. 탭이 비활성화되면 온라인 랭킹 세션을 종료하며, 사용자가 직접 일시정지한 판도 랭킹에 제출하지 않습니다. 효과음은 음소거할 수 있습니다.

## 기록 검증 범위

서버는 게임 시작 시 세션 토큰과 문제 시드를 만들고, 제출된 색상 순서·정답 선택·시간 제한·점수 공식을 재계산합니다. 준비된 PHP 세션은 한 번만 제출할 수 있으며 API 요청도 제한합니다. 익명 플레이어 식별자는 HTTPS 환경에서 `Secure`, `HttpOnly`, `SameSite=Lax` 쿠키로 관리하고 DB에는 해시만 저장합니다.

브라우저에서 실행되는 게임이므로 클라이언트 입력 기록을 완전히 신뢰할 수는 없습니다. 시간 기록과 세션 검증은 조작 난도를 높이고 명백히 불가능한 결과를 걸러내지만, 완전한 부정행위 방지를 보장하지 않습니다.

## PARRY: LAST BLADE

- 아케이드의 두 번째 게임입니다. `/parry.html`은 포털과 별도로 빌드되므로 Hostinger에서는 `dist` 내용물을 통째로 업로드하면 됩니다.
- PC는 방향키 또는 `W/A/S/D`, 모바일은 화면 하단 십자 패드로 패링합니다. 누르고 있으면 입력을 반복하지 않습니다.
- 보스 검이 충돌하는 순간 기준 ±70ms는 PERFECT, ±150ms까지는 GOOD입니다. 공격 방향이 틀리거나 타이밍을 놓치면 보스 공격력만큼 플레이어 HP가 깎입니다.
- PERFECT는 보스에게 25 피해, GOOD은 10 피해를 주며 보스 격파 시 플레이어 HP를 15 회복합니다. HP는 100에서 시작하고 0이 되면 종료됩니다.
- 1–6번 보스는 각각 정해진 공격 난이도와 피해량을 가지며, 이후에는 무한 보스전으로 이어집니다. 연격 간 입력 간격은 최소 550ms, 예고시간은 최소 520ms입니다.
- 오늘의 검성전은 KST 날짜별 공통 시드를 사용합니다. 무한 생존과 오늘의 도전 랭킹은 처치 보스 수, 현재 보스 패링 수, 점수, PERFECT 비율 순으로 정렬합니다.
- PARRY 전용 API는 `/api/parry.php`이며 공격 패턴을 시드에서 재생성하고 입력 순서·방향·판정·진행 시간을 서버에서 확인합니다. 클라이언트 게임의 특성상 결과 조작 방지를 완전히 보장하지는 않습니다.
- 일시정지 버튼, `Esc`, 브라우저 탭 전환은 전투 타이머를 일시정지합니다. 효과음 설정은 브라우저에 저장됩니다.
- 3D 엔진과 기사 모델은 첫 시작 시 불러오며, 모델 로딩을 완료한 뒤 카운트다운을 시작합니다. WebGL 2를 지원하는 최신 PC·모바일 브라우저가 필요합니다. 모바일은 렌더링 해상도와 그림자 크기를 낮춰 GPU 부하를 줄입니다.
- 기사 관절은 Meshy의 Mixamo 스켈레톤을 사용하며, 게임의 공격 시점에 맞춰 양팔을 움직입니다. 성채와 검은 코드로 만든 3D 메시입니다. 화면 하단 방향 버튼과 체력·점수는 HTML로 표시합니다.

## 통통! 해적 룰렛 (Pirate Barrel)

- [게임 열기](https://noltap.com/pirate.html). 2~8명이 한 컴퓨터나 모바일 기기에서 차례로 플레이하는 로컬 패스 앤 플레이 방식입니다. 온라인 매칭과 컴퓨터 상대는 없습니다.
- 게임 시작 전에 각자 이름과 서로 겹치지 않는 칼 색을 정합니다. 빨강·파랑·노랑·초록·보라·분홍·주황·검정 중 선택한 색이 실제 3D 칼 손잡이와 통에 꽂힌 칼에 적용됩니다.
- 각 라운드에는 통의 16개 구멍 중 한 곳에 무작위 함정이 있습니다. 플레이어가 순서대로 구멍을 골라 칼을 꽂고, 함정이 나오면 그 라운드가 끝납니다. 새 라운드마다 첫 플레이어와 함정 위치가 바뀝니다.
- 점수나 누적 라운드 없이, 해적이 튀어나오게 한 사람이 당첨되면 한 판이 끝납니다. 같은 멤버로 바로 다시 하거나 참가자를 바꿀 수 있습니다.
- 칼을 꽂을 구멍은 마우스나 터치로 고릅니다. 드래그 또는 회전 화살표로 3D 통을 돌릴 수 있고, 키보드 `Tab`으로 구멍을 이동해 `Enter`로 선택할 수 있습니다. WebGL을 사용할 수 없는 환경에서는 번호 목록으로 플레이합니다.
- 효과음은 음소거할 수 있습니다. 설정과 완료한 대전 수·최고 참가자 점수는 현재 브라우저에 저장됩니다. 새로고침하면 진행 중인 대전은 초기화됩니다.
- 게임은 실제 돈이나 상품을 걸지 않는 캐주얼 게임입니다. 기록은 브라우저에만 저장되며 온라인 랭킹이나 서버 검증을 제공하지 않습니다.

## 주요 파일

- `index.html`: 한국어 문서 설정, 모바일 화면 설정, 앱 진입점
- `src/main.js`: 아케이드 허브와 게임 UI, 상태 관리, 결과·기록·랭킹 연결
- `src/game-engine.js`: 시드 기반 색상 문제, 제한시간, 점수 공식
- `src/ranking-api.js`: 익명 플레이어 키, 닉네임, PHP API 요청
- `src/style.css`: 다크 네온 디자인, 게임 상태 표현, PC·모바일 레이아웃
- `parry.html`: PARRY 게임의 독립 페이지 진입점
- `src/parry-entry.js`, `src/parry-game.js`: PARRY UI, 조작, 보스 러시 상태와 기록
- `src/parry-engine.js`: 공격 패턴 시드, 난이도, 판정·점수 규칙
- `src/parry-three.js`: Three.js 3D 성채, Meshy 모델 로더, 관절 동작, 검과 충돌 효과
- `src/parry-rig.js`: 손 뼈의 그립 소켓, 양팔 도달 거리 제한, 손목 방향 및 손가락 그립
- `src/parry-actor.js`: 보스별 모델, 체격, 손잡이와 관절 구성
- `src/parry-motion.js`: 방향을 유지하는 준비 자세 → 실제 베기 궤적과 HUD 단계 (페이크는 6번째 보스부터)
- `src/parry-performance.js`: 렌더 픽셀 예산과 지속적인 프레임 지연에 따른 해상도 자동 조절
- `public/models/parry-knight.glb`: 텍스처·스켈레톤이 포함된 Meshy 기사 모델
- `pirate.html`: 통통! 해적 룰렛의 독립 진입점
- `src/pirate/main.js`, `src/pirate/engine.js`: 플레이어 설정·턴·라운드·점수와 게임 상태
- `src/pirate/scene.js`, `src/pirate/config.js`: Three.js 통 장면, 칼 색상, GLB 모델과 16개 구멍 위치
- `src/pirate/model-loader.js`: 다운로드·이미지 해석의 개별 제한시간, 모델 버퍼 재사용과 재시도
- `public/api/pirate-model.php`: 허용된 통·해적·칼 모델만 전달하는 PHP 엔드포인트
- `src/pirate/audio.js`, `src/pirate/style.css`: 효과음·음소거와 해적 룰렛 화면·반응형 레이아웃
- `public/models/barrel.glb`, `pirate.glb`, `knife.glb`: 해적 룰렛의 3D 통·캐릭터·칼
- `public/audio/knife-wood-insert.wav`: 칼을 통에 꽂을 때 재생하는 효과음
- `docs/PIRATE_BARREL.md`: 해적 룰렛의 규칙과 배포 안내
- `src/parry-api.js`, `public/api/parry.php`: PARRY 세션·랭킹 API와 서버 검증
- `database/parry-v1.sql`: 기존 DB에 추가하는 PARRY 전용 랭킹 테이블
- `public/api/index.php`: 프로필, 게임 시작·제출, 랭킹 API 라우트
- `public/api/lib.php`: DB 연결, 입력 검증, 패턴/점수/순위 계산, 요청 제한
- `public/api/config.example.php`: Hostinger DB 설정 예시
- `database/schema.sql`: MySQL/MariaDB 테이블 생성 SQL
- `database/migrate-v2.sql`: 기존 v1 DB를 새 색상 게임 기록 구조로 변경하는 1회성 마이그레이션
- `test/game-engine.test.js`: 제한시간·시드·배경색·점수 규칙 테스트
- `vite.config.js`: 개발 중 `/api`를 PHP 서버로 프록시
- `dist/`: Hostinger에 업로드할 빌드 출력물

## 확장 방향

게임 화면과 난이도 엔진, API가 파일별로 나뉘어 있어 새 게임을 허브에 추가할 수 있습니다. 업적·개인 기록·서버 랭킹과 텍스트/링크 공유를 지원합니다. 서버 DB를 설정하지 않아도 로컬로 플레이할 수 있으며, 이 경우 온라인 랭킹 제출은 사용할 수 없습니다.
