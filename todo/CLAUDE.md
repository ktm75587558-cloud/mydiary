# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

A personal diary app (codename **고슴도치**) used daily by one person. Static files only: **no build step, no package manager, no dependencies, and no test suite** — do not add `package.json`, bundlers, or frameworks unless asked.

```
index.html    다이어리 (달력 + 선택한 날 상세)
about.html    자기소개. 개인 정보가 아직 예시값임 (홍길동, your-email@example.com, github.com/your-id)
css/theme.css 색 변수 + 공유 기본 스타일 (두 페이지가 같이 씀)
css/app.css   다이어리 화면 레이아웃
js/theme.js   라이트/다크 토글 (두 페이지가 같이 씀)
js/dates.js   날짜 계산
js/mood.js    기분 5단계 정의
js/store.js   localStorage 접근 전부
js/calendar.js 월간 달력
js/search.js  일기 검색
js/app.js     화면 조립 + 연결
```

## Running

**`index.html`을 브라우저로 그냥 열면 된다** (더블클릭). 서버가 필요 없다.

이걸 지키려고 **ES 모듈(`<script type="module">`)을 쓰지 않는다** — 모듈은 `file://`에서 CORS로 차단되어 앱이 아예 뜨지 않는다. 평범한 `<script src>`를 순서대로 둔다.

파일을 새로 추가할 때는 `index.html` 맨 아래 `<script>` 목록에 **의존 순서대로** 넣는다: `theme → dates → mood → store → calendar → search → app`. 뒤가 앞을 쓴다.

서버로 띄우고 싶다면:

```powershell
python -m http.server 8000   # http://localhost:8000/index.html
```

## Conventions

- **UI text and code comments are Korean.** Comments explain *why* a choice was made, not what the line does.
- **Vanilla DOM only** — `document.createElement` + `addEventListener`. 사용자가 입력한 글을 `innerHTML`로 넣지 않는다. 검색 강조(`<mark>`)도 문자열을 쪼개 `createTextNode`/`createElement`로 붙인다(`js/search.js`의 `highlight()`).
- **각 JS 파일은 전역 하나만 노출한다** (`Theme`, `Dates`, `Mood`, `Store`, `Calendar`, `Search`). 파일 내부는 IIFE로 감싼다. `app.js`는 아무것도 노출하지 않는다.
- **`localStorage`는 `js/store.js`를 통해서만 만진다.** 예외는 `theme` 키 하나로, `js/theme.js`와 각 페이지 `<head>`의 인라인 스크립트가 직접 읽고 쓴다.

## Cross-page theme contract

두 페이지가 `css/theme.css`와 `js/theme.js`를 **공유한다**. 예전처럼 페이지마다 복사하지 않으므로, 테마를 고칠 때 양쪽에 같은 수정을 반복할 필요가 없다.

- 색은 CSS 변수로만 쓰고 **세 블록 모두에** 선언한다: `:root`(라이트) / `@media (prefers-color-scheme: dark)` 안의 `:root:not([data-theme="light"])` / `:root[data-theme="dark"]`. 가운데 블록의 `:not()`이 "직접 고른 라이트가 OS 다크보다 우선"을 만든다. 새 색을 하나라도 빠뜨리면 그 테마에서만 값이 없어 조용히 깨진다.
- `color-scheme: dark`를 다크 블록에 두어 체크박스·스크롤바 같은 기본 부품도 따라가게 한다.
- 고른 테마는 `localStorage`의 **`theme`**(`"light"` | `"dark"`)에 저장하고 두 페이지가 공유한다. 저장된 값이 없으면 `matchMedia`로 OS를 따르고, **직접 눌렀을 때만** 저장한다.
- **`<head>`의 블로킹 인라인 스크립트**가 그림 그리기 전에 `theme`을 읽어 `document.documentElement.dataset.theme`에 넣는다. 새로고침 때 흰 화면이 번쩍이는 걸 막는 유일한 목적이므로 **외부 파일로 빼지 말 것** — 로드가 늦어 번쩍임이 되살아난다. 페이지를 새로 만들면 여기에도 그대로 넣는다.

## 날짜 규칙 (`js/dates.js`)

날짜는 어디서나 **`"YYYY-MM-DD"` 문자열** 하나로만 다룬다. `Date`나 타임스탬프를 저장하지 않는다.

- 변환이 없어 시간대의 영향을 받지 않고, 문자열 비교만으로 순서가 맞고, JSON으로 그대로 오간다.
- 문자열을 `Date`로 되돌릴 때는 **`'T00:00:00'`을 반드시 붙인다**(`Dates.parse()`). 안 붙이면 `new Date("2026-09-30")`이 **UTC** 자정으로 읽혀 음수 시간대에서 하루 밀린다.
- 오늘을 구할 때 **`toISOString().slice(0,10)`을 쓰지 않는다** — UTC라서 한국 시간 오전 9시 전엔 어제가 나온다. `Dates.today()`를 쓴다.
- 날짜끼리 비교할 때 `Date` 객체를 쓰지 않는다. 오른쪽에 현재 시·분이 섞여 들어간다. 문자열끼리 비교한다.
- `Dates.addMonths()`는 그 달에 없는 일(日)을 말일로 당긴다 (1/31 +1달 = 2/28).
- `Dates.isValid()`는 `2026-02-29`처럼 굴러가는 값을 걸러낸다 — 되돌려 찍어 원래 문자열과 같은지 본다.

## 저장 구조 (`js/store.js`)

`localStorage`의 **`diary`** 키 하나에 전부 들어간다.

```js
{ version: 1,
  days: { "2026-10-04": { mood: 4, note: "비가 왔다…",
                          todos: [{ id: "k3f9a1", text: "운동하기", done: true }] } } }
```

- **할 일은 그날에 속한다.** 마감일(`due`) 개념이 없고, 자동 이월도 없다. 어제 미완료를 오늘로 옮기는 건 사용자가 버튼을 눌렀을 때만 일어난다(`Store.pullFrom()`) — "이걸 진짜 할 건가"를 한 번 묻게 하려는 의도적 설계다.
- `mood`는 1~5 또는 키 없음. `note`는 빈 문자열이면 키를 지운다.
- **내용이 하나도 없는 날은 날짜 키째 지운다**(`prune()`). 빈 껍데기가 쌓이면 내보낸 파일만 커진다. 모든 변경 끝에 불러 준다.
- `id`는 `crypto.randomUUID().slice(0, 8)`. **`Date.now()`를 쓰지 않는다** — 같은 밀리초에 추가하거나 가져오기로 여러 건이 한꺼번에 들어오면 겹치고, 겹친 `id`는 엉뚱한 항목을 지운다.
- 들어온 값은 전부 `sanitize()`를 거친다. 깨진 저장값·직접 고친 파일이 와도 앱이 죽지 않고 빈 상태로 시작한다.
- **저장 실패를 조용히 삼키지 않는다.** `Store.save()`는 성공 여부를 돌려주고, 실패하면 `Store.onError()`로 등록된 콜백이 화면에 띠를 띄운다. 할 일이면 몰라도 **일기가 저장되지 않은 걸 모르면 안 된다** — 다시 쓸 수 없는 글이다.
- 가져오기는 받아들이기 전에 `version`과 모양을 검사하고, 통과하지 못하면 **기존 데이터를 건드리지 않는다**. 저장에 실패하면 이전 데이터로 되돌린다.
- 예전 키(`todos`·`notes`)는 `Store.migrateLegacy()`가 **앱 시작 때 한 번만** 새 구조로 옮긴다. `sortBy`는 버린다.
  - 마감일(`due`)은 **되살리지 않는다.** 어느 날짜에 붙일지 정하는 근거로만 쓰고(없으면 오늘), 필드로 저장하지 않는다.
  - **덮어쓰지 않는다** — 새 앱에서 이미 쓴 `note`가 있으면 건너뛰고, 할 일은 기존 목록 뒤에 붙인다.
  - `id`는 새로 매긴다. 옛 `id`는 `Date.now()` 숫자라 서로 겹칠 수 있다.
  - 두 번 돌지 않도록 별도 키 **`diaryMigratedV1`**을 세운다. 옮길 게 없었어도 세운다. `diary` 안이 아니라 별도 키인 이유는 가져오기로 `diary`를 통째로 바꿔도 마이그레이션이 되살아나면 안 되기 때문이다.
  - **옛 키는 지우지 않는다.** 복구가 잘못돼도 되돌릴 수 있어야 한다.

## 화면 그리기 (`js/app.js`)

- 변경은 `Store`를 고치고 `refresh()`를 부르는 한 가지 흐름을 따른다. `refresh()`는 달력과 상세 패널을 **통째로 다시 그린다**. 부분 DOM 갱신이 없으므로 새 기능은 `renderDetail()`을 확장한다.
- **예외가 하나 있다: 일기 `textarea`.** 입력 중에 다시 그리면 커서와 포커스가 날아간다. 그래서 `textarea`는 정적 DOM으로 두고 **날짜가 바뀔 때만** 값을 갈아 끼운다(`noteShownFor`). 글은 칠 때마다 바로 저장한다.
- 선택 상태의 주인은 `app.js`의 `selected`다. `Calendar.show()`를 직접 부르면 둘이 어긋나므로, 날짜를 바꿀 때는 항상 `app.js`의 `select()`를 거친다.
- 날짜 이동 수단은 **상세 패널의 `‹ 어제` / `오늘` / `내일 ›` 줄 하나로 모아 둔다.** 달력 헤더의 `‹ ›`는 달 이동만 맡는다. 같은 일을 하는 버튼이 두 군데 있으면 헷갈리기 때문. 키보드 `←` `→` `T`도 같은 `select()`를 거치므로 버튼과 결과가 늘 같다.
- 단축키는 `input`/`textarea`에 포커스가 있으면 **끈다**. 안 그러면 일기에 `t`를 못 친다.
- 페이지를 열어둔 채 자정을 넘기면 "오늘"이 어제에 머문다. `visibilitychange`에서 날짜가 바뀌었는지 보고 다시 그려 해결한다.

## Other agent configs present

`~/.codex` 와 `~/.gemini` 가 이 컴퓨터에 있다. 거기 있는 MCP 서버·커맨드·서브에이전트·스킬·지침을 Claude Code로 가져오고 싶으면 `/import` 로 스캔해 목록을 보고, `/import --yes=<digest>` 로 사용자 레벨 항목을 적용한다. 이 환경에서 `/import` 가 없으면 터미널에서 `claude import` 를 실행한다.
