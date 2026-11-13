# 자료별 공개 범위

## rates.json

출처: ECOS(한국은행), 예금은행 수신금리(신규취급액 기준), 저축성수신, 연%. 공식 통계표121Y002. 1996년1월부터2026년6월까지366개월. 확인2026.11.10.

https://ecos.bok.or.kr/#/SearchStat

공식 조회표에서 추출한366개와 기존 시제품 수치를 비교해 모두 같았습니다. 한국은행 작성 통계는 출처를 명시하면 상업적 용도를 포함하여 무료 사용·가공·재배포할 수 있다는 ECOS 통계정보이용지침을 적용합니다. 이 외부 통계에 MIT를 부여하지 않습니다. 출처표시는 재사용 시에도 유지하세요.

현행 통계의 과거 월별 수치이며 당시 최초 공표일이나 그날 가입할 수 있던 상품금리가 아닙니다. 게임은 보수적 M-2월 지연을 쓰지만 해당시점 이용가능성을 확정하지 않습니다. 실제 금융상품을 재현한 것이 아닙니다.

## turns.json

직접 작성한 턴 유형·단계·시연 시간 규칙입니다. 아래 MIT License는 turns.json에만 적용합니다. 외부 통계와 역사 기사의 문장·사진·연속시세표는 포함하지 않습니다.

## 현재 본게임 자료 배포

본게임은 GitHub Pages에서 플레이할 수 있습니다.

https://sigco3111.github.io/return-investor/

`events.json`, `prices.json`, `unlocks.json`, `early-school-news.json`과 보존 세대 자료는 저장소 루트의 `3-game-data.json.gz`에 경로별 JSON 문자열로 묶여 있습니다. 루트의 `22-main.jsx`를 빌드한 실행본이 이 압축 묶음을 읽습니다. `data/` 폴더의 개별 파일만으로 전체 배포 자료를 판단하지 마세요. 새로 받은 저장소의 실행·빌드·브라우저 점검 방법은 루트 `README.md`를 따릅니다.

압축 배포는 자료의 권리 상태나 정확도를 바꾸지 않습니다. 외부 통계·시세·역사 자료는 각 출처와 자료별 고지를 유지하며, 아래 MIT License가 외부 자료 전체에 적용되는 것은 아닙니다. 당시 공개일·실제 상품 기준가·거래 가능 가격이 확인되지 않은 지점은 게임 안의 자료 한계 고지를 함께 확인해야 합니다.

## turns.json의 MIT License

MIT License

Copyright (c) 2026 HEE JUNG SHIN

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without
limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom
the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Scope

This license applies to the project's directly generated PNG background and
character assets in this assets/ directory and the asset listing in README.md.
The assets are fictional generated game art, not photographs, historical
reconstructions or depictions of a real individual. A grant is made only to the
extent rights are held; no claim is made that every generated pixel is
independently eligible for copyright protection.

It does not relicense external news articles, photographs, market databases,
statistics, source websites, names, trademarks, or third-party materials.
Those materials are not included in this asset release. Other repository files
retain their separately stated licensing status.
