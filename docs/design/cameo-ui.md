# Cameo 공통 UI

## 기준과 범위

- 기준: `docs/mockup/shared/Cameo UI Spec.htm`과 함께 제공된 전체 화면 스크린샷.
- HTML은 저장된 아티팩트 외곽 문서이며, 참조하는 `Cameo UI Spec_files/saved_resource.html`이 없다. 상세 값과 31개 항목은 스크린샷에서 확인했다.
- 사용자 승인 범위: 전역 디자인 토큰, `src/shared/ui` 공용 컴포넌트, `/ui` 카탈로그.
- `/ui`는 시작 가이드와 같은 공통 Layout의 콘텐츠 영역에 표시되며 헤더·사이드바·푸터를 공유한다. 반응형 배치는 실제 콘텐츠 영역의 너비를 기준으로 한다.
- `/ui`가 실행 가능한 카탈로그다. 별도의 정적 HTML 복제본은 만들지 않는다.
- 서비스 컴포넌트는 밝은 표면을 기준으로 한다. 어두운 카탈로그 설명 영역은 페이지 전용 스타일이다.

## 소유권

| 위치                      | 책임                                                              |
| ------------------------- | ----------------------------------------------------------------- |
| `src/app/styles/app.css`  | Primitive palette, semantic aliases, 크기·간격·radius·motion 토큰 |
| `src/shared/ui/ui.css`    | 공용 컴포넌트 스타일, Tailwind components layer                   |
| `src/shared/ui/*.tsx`     | 도메인에 종속되지 않는 공용 UI                                    |
| `src/pages/ui/UiPage.tsx` | 쇼케이스 페이지 조립                                              |
| `src/pages/ui/ui`         | 예시, 스펙 표, 카탈로그 스타일                                    |
| `src/pages/ui/model`      | 로컬 데모 상태와 인터랙션                                         |
| `src/pages/ui/config`     | 카탈로그에 표시할 토큰·규격 목록                                  |
| `public/fonts`            | 자체 호스팅 Noto Sans KR / Space Grotesk 및 OFL 라이선스          |

새 화면은 공용 UI를 직접 import하고, 시즌·지갑 데이터와 실제 거래 로직은 해당 페이지에서 관리한다. `shared`는 `pages`나 `app`을 import하지 않는다.

## 토큰과 사용 규칙

- Black `#171717`, Web3 `#641ACB`, Red `#EE2233`, Active `#5D4EE2`, Blue `#2A43D0`.
- Gray 50–800은 레퍼런스 값으로 정의했다.
- 기존 `--background`, `--foreground`, `--primary`, `--card`, `--border` 등의 이름을 유지하고 Cameo semantic 토큰에 연결했다.
- `--primary`는 검정이다. 블록체인 액션은 `Button variant="web3"`를 사용한다.
- 기본 버튼은 `primary` / `md`. 기존 `default`, `outline`, `destructive`, `link` API도 유지한다.
- 높이: lg 56px, md 48px, sm 36px, icon 40px. Text Input 48px, Search Input 26px.
- Radius: Button 12px, Input 10px, Modal 24px, Card 14px, Checkbox 4px, Picker 8px.
- 버튼 기본 type은 `button`. 폼 제출은 `type="submit"`을 명시한다.
- `loading`은 이름을 유지하면서 spinner와 `aria-busy`를 표시하고 반복 실행을 차단한다. `asChild` 링크도 로딩·비활성 중 활성화를 차단한다.
- 기존 테마 공급자는 유지한다. `.cameo-light`는 카탈로그 샘플과 포털 모달의 밝은 표면을 고정한다.
- 모든 컴포넌트 스타일은 CSS 토큰을 사용한다. `className`에 전달한 Tailwind utility로 필요한 스타일을 덮어쓸 수 있다.

## 레퍼런스 31항목 매핑

| 번호  | 레퍼런스                                                      | 실제 공용 UI                                                                                   |
| ----- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 1–4   | Text / Search / Checkbox / Date-Time                          | `Input` + `Field`, `SearchInput`, `Checkbox`, `DateTimePicker`                                 |
| 5–7   | Slider / Color / Opacity·Brush                                | `Slider`, `ColorPicker`, `Slider compact`                                                      |
| 8–10  | Top / Tab / Sidebar Navigation                                | `Navigation`, `Tabs`, `Navigation variant="sidebar"`                                           |
| 11–15 | Season / Profile / Info / Season List / NFT Holder            | `MediaCard`, `ProfileCard`, `InfoCard`, `MediaListItem`, `DataRow`                             |
| 16–20 | Modal / Glass Panel / Glass Confirm / Close / Overlay         | `DialogContent`, `GlassPanel`, `ConfirmDialog glass`, `DialogCloseButton`, `DialogOverlay`     |
| 21–22 | Active / Ended Badge                                          | `StatusBadge`의 두 상태                                                                        |
| 23–25 | Toggle / Zoom / Preview                                       | `ToggleGroup`, `ZoomControls`, `PreviewBox`                                                    |
| 26–31 | Wallet Row / Transaction / Pagination / FAB / Connect / Stats | `SelectionRow`, `TransactionList`, `Pagination`, `FloatingActionButton`, `Button`, `StatsCard` |

공통 Dialog는 Radix의 포커스 유지와 Escape 동작을 사용한다. ConfirmDialog는 처리 중 취소·닫기를 차단한다. Tabs는 방향키와 Home/End를 지원한다. 입력은 `Field`로 label·오류 설명을 연결한다.

## 레퍼런스 보완 사항

- Web3 로딩 배경 `#9B7EC8`는 유지한다. 14–16px 글자는 흰색 대신 `#171717`을 사용한다. 계산한 대비는 5.30:1이다.
- 레퍼런스에 없는 페이지네이션 현재 페이지는 검정 배경과 흰색 숫자, `aria-current`로 표현한다.
- Toggle의 비선택 글자는 작은 10px 글자의 가독성을 위해 gray-600을 사용한다.
- 레퍼런스의 tertiary·placeholder `#8E8E8E`는 유지했다. 흰색 대비 3.28:1로, 일반 본문용 4.5:1 기준을 충족하지 않는다. 중요한 설명은 secondary 토큰을 사용한다. 전체 접근성 적합성을 주장하지 않는다.
- 폰트는 Google Fonts 제공 파일을 로컬에 포함했다. 각 서체의 OFL 라이선스를 `public/fonts`에 보관한다. 화면 실행 시 외부 폰트 서버를 요청하지 않는다.

## 검증 — 2026-09-29

- `npm run build`: 통과.
- `npm run lint`: 통과.
- `npm test`: 11개 파일, 33개 테스트 통과.
- `git diff --check`: 통과.
- Chromium: 1440 / 768 / 375 / 320px에서 문서 가로 넘침 없음. 데스크톱·모바일 화면을 직접 확인했다.
- 실제 렌더링: 공통 예시 31개, 버튼 높이 56/48/36/40px, Input 48px, 두 폰트 로딩 확인.
- 검색 빈 결과·체크박스·HEX 색상·슬라이더 방향키·탭 이동·도구 선택·확대·페이지 이동·지갑 선택 데모·도움말 확인.
- 일반 모달과 Glass Confirm의 닫기 및 포커스 복귀 확인. 일반 모달 내부 키보드 포커스 확인.
- 모션 축소 환경에서 spinner 애니메이션 축소 확인.
- `/ui` 로딩 리소스에 외부 origin 요청 없음.
- 기존 홈과 `/ui`에 동일한 React 개발 콘솔 메시지(`Encountered a script tag while rendering React component`)가 발생한다. 기존 테마 공급자를 교체하는 작업은 포함하지 않았다. 최초 favicon 요청의 404도 기존 상태다.
- 스크린리더, Safari/Firefox, 200% 텍스트 확대는 별도 검증하지 않았다.

## 실행

```sh
npm run dev
```

`http://localhost:5173/ui`에서 확인한다. 기존 프로젝트 메뉴의 ‘공통 UI’에서도 진입할 수 있다. 모든 예시는 로컬 상태만 사용하며 실제 지갑 연결·서명·결제를 실행하지 않는다.
