const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
const fs = require('fs');
const express = require('express');
const path = require('path');
const cors = require('cors');
const EventEmitter = require('events');

// 스텔스 플러그인 사용
chromium.use(stealth);

// 전역 상태 관리
const logEmitter = new EventEmitter();
let isStopRequested = false;

function sendLog(msg) {
    console.log(msg);
    logEmitter.emit('log', { type: 'text', message: msg });
}

function sendStats(count) {
    logEmitter.emit('log', { type: 'stats', count: count });
}

// --- 설정 (Configuration) ---
const CONFIG = {
    // ⚙️ 상품 조건 설정 ⚙️
    categories: [419509], // 수집할 카케고리 ID 리스트
    maxPages: 2,          // 카테고리당 수집할 최대 페이지 수 (페이지당 약 60개)
    minPrice: 20000,      // 상품 최소 가격
    maxPrice: 50000,      // 성퓸 최대 가격
    // ⚙️ 리뷰 조건 설정 ⚙️
    reviewDays: 30,       // 기간 설정 (최근 며칠 이내의 리뷰만 수집할지)
    checkPage: 20,        // 확인할 리뷰 페이지 (페이지당 10개, 예: 20페이지면 약 200번째 리뷰 확인)
    resultFile: 'result.json' // 결과 저장 파일명
};

/* 여기 밑으로는 건들면 큰일이 나부려요~~
🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅
🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅
🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅
🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅
🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅🙅
*/

// 카테고리 페이지 URL 생성기
const getCategoryUrls = () => CONFIG.categories.map(catId =>
    `https://www.coupang.com/np/categories/${catId}?listSize=120&filterType=&rating=0&isPriceRange=true&minPrice=${CONFIG.minPrice}&maxPrice=${CONFIG.maxPrice}&component=&sorter=saleCountDesc&brand=&offerCondition=&filter=&fromComponent=N&channel=user&selectedPlpKeepFilter=`
);

// 도우미 함수: 랜덤 지연
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// 도우미 함수: 기존 결과 로드 (이어서 하기 로직용)
function loadExistingResults(filename) {
    try {
        if (fs.existsSync(filename)) {
            const data = fs.readFileSync(filename, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        sendLog('[WARN] 기존 결과 파일을 로드하지 못했습니다. 새로 시작합니다.');
    }
    return [];
}

/**
 * 메인 함수: 통합 크롤링 프로세스
 */
async function runUnifiedCrawl(userConfig) {
    let browser = null;
    const currentConfig = { ...CONFIG, ...userConfig }; // Merge default with user-provided config
    let allResults = loadExistingResults(currentConfig.resultFile);
    const processedIds = new Set(allResults.map(r => r.productId));

    sendStats(allResults.length); // 초기 건수 전송
    sendLog(`[INFO] 시작: ${allResults.length}개의 상품 이어서 수집 가능.`);

    try {
        sendLog('[INFO] 9222 포트에서 실행 중인 크롬 인스턴스에 연결 중...');
        browser = await chromium.connectOverCDP('http://localhost:9222');
        const context = browser.contexts()[0];
        const page = await context.newPage();

        const categoryUrls = currentConfig.categories.map(catId =>
            `https://www.coupang.com/np/categories/${catId}?listSize=120&filterType=&rating=0&isPriceRange=true&minPrice=${currentConfig.minPrice}&maxPrice=${currentConfig.maxPrice}&component=&sorter=saleCountDesc&brand=&offerCondition=&filter=&fromComponent=N&channel=user&selectedPlpKeepFilter=`
        );

        isStopRequested = false; // 시작 시 초기화
        let sessionProcessedCount = 0; // 연속 처리 상품 개수
        let nextBreakCount = Math.floor(Math.random() * 10) + 25; // 다음 휴식까지의 목표 개수 (25~34개)

        for (const baseUrl of categoryUrls) {
            if (isStopRequested) break;
            sendLog(`\n${'='.repeat(80)}`);
            sendLog(`[카테고리] 시작: ${baseUrl}`);
            sendLog(`${'='.repeat(80)}`);

            for (let currentPage = 1; currentPage <= currentConfig.maxPages; currentPage++) {
                const lpUrl = `${baseUrl}&page=${currentPage}`;
                sendLog(`\n[목록 페이지] ${currentPage}페이지로 이동 중: ${lpUrl}`);

                await page.goto(lpUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                await delay(5000); // 안정화를 위한 대기

                // 1. 현재 목록 페이지의 모든 상품 ID 추출
                const productsOnPage = await page.evaluate((minPrice) => {
                    const items = [];
                    // 클래스명 해시값이 바뀌어도 동작하도록 수정
                    document.querySelectorAll('[class*="ProductUnit_productUnit"]').forEach(unit => {
                        const link = unit.querySelector('a[href*="/vp/products/"]');
                        if (!link) return;

                        let priceText = null;
                        const walker = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT, null, false);
                        let node;
                        while ((node = walker.nextNode())) {
                            if (node.nodeValue.includes('원')) {
                                let text = node.nodeValue.trim();
                                // <del> 태그(할인 전 가격)가 아닌 실제 가격 추출
                                if (/^[0-9,]+원$/.test(text) && node.parentElement && node.parentElement.tagName !== 'DEL') {
                                    priceText = text;
                                }
                            }
                        }

                        if (!priceText) return;

                        const price = parseInt(priceText.replace(/[^0-9]/g, ''), 10);
                        if (price < minPrice) return;

                        const href = link.getAttribute('href');
                        const urlObj = new URL(href, window.location.origin);
                        const idMatch = urlObj.pathname.match(/\/vp\/products\/(\d+)/);

                        if (idMatch) {
                            items.push({
                                productId: parseInt(idMatch[1]),
                                itemId: urlObj.searchParams.get('itemId') || '',
                                vendorItemId: urlObj.searchParams.get('vendorItemId') || ''
                            });
                        }
                    });
                    return items;
                }, currentConfig.minPrice);

                sendLog(`[목록 페이지] ${productsOnPage.length}개의 잠재적 상품을 발견했습니다.`);

                // 2. 발견된 각 상품 처리
                for (let i = 0; i < productsOnPage.length; i++) {
                    if (isStopRequested) break;
                    const product = productsOnPage[i];
                    const progress = `[카테고리:${baseUrl.split('/').pop().split('?')[0]} (${currentPage}/${currentConfig.maxPages}) | 상품:${i + 1}/${productsOnPage.length}]`;

                    if (processedIds.has(product.productId)) {
                        sendLog(`${progress} ⏩ 상품 ${product.productId} 건너뜀 (이미 처리됨)`);
                        continue;
                    }

                    // 상품 상세 페이지 URL 생성 (로그 및 저장용)
                    const detailUrl = `https://www.coupang.com/vp/products/${product.productId}?itemId=${product.itemId}&vendorItemId=${product.vendorItemId}`;
                    sendLog(`\n${progress} 🔄 분석 중: ${detailUrl}`);

                    try {
                        // [개선 3] 화면 스크롤 및 마우스 움직임 (사람인 척 위장)
                        if (!isStopRequested) {
                            try {
                                const scrollY = Math.floor(Math.random() * 600) - 100; // 위아래 랜덤 스크롤
                                await page.mouse.wheel(0, scrollY);
                                await page.mouse.move(Math.floor(Math.random() * 800) + 100, Math.floor(Math.random() * 600) + 100, { steps: 5 });
                                await delay(Math.floor(Math.random() * 1000) + 500); // 짧은 딜레이
                            } catch (e) { }
                        }

                        // 페이지 이동을 최소화하기 위해 '현재 목록 페이지(lpUrl)'에서 
                        // 곧바로 해당 상품의 리뷰 API만 비동기로 찔러서 데이터만 가져옴.
                        const reviewData = await page.evaluate(async ({ pid, targetPage }) => {
                            try {
                                // 쿠팡 시스템에 사람처럼 보이기 위한 랜덤 지연 (브라우저 컨텍스트 내)
                                await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));

                                const apiUrl = `https://www.coupang.com/next-api/review?productId=${pid}&page=${targetPage}&size=10&sortBy=DATE_DESC&market=kr`;
                                const response = await fetch(apiUrl, {
                                    // [개선 2] 실제 브라우저처럼 보이기 위한 정교한 HTTP Header 추가
                                    headers: {
                                        'Accept': 'application/json, text/plain, */*',
                                        'Accept-Language': navigator.language || 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                                        'User-Agent': navigator.userAgent,
                                        'Referer': window.location.href, // 중요: 목록에서 보낸 것처럼 위장
                                        'Sec-Fetch-Dest': 'empty',
                                        'Sec-Fetch-Mode': 'cors',
                                        'Sec-Fetch-Site': 'same-origin',
                                        'Cache-Control': 'no-cache',
                                        'Pragma': 'no-cache'
                                    }
                                });

                                if (response.ok) {
                                    const data = await response.json();
                                    const contents = data.rData?.paging?.contents || [];
                                    if (contents.length > 0) {
                                        const last = contents[contents.length - 1];
                                        return {
                                            success: true,
                                            count: contents.length,
                                            lastReviewAt: last.reviewAt ? new Date(last.reviewAt).getTime() : null,
                                            lastReviewDate: last.reviewAt ? new Date(last.reviewAt).toISOString().split('T')[0] : '',
                                            lastName: last.name || ''
                                        };
                                    } else {
                                        return { success: true, count: 0 }; // 성공했지만 리뷰가 없는 경우
                                    }
                                } else {
                                    // 403 Forbidden 등 에러 발생 시
                                    return { success: false, status: response.status };
                                }
                            } catch (e) {
                                return { success: false, error: e.message };
                            }
                        }, { pid: product.productId, targetPage: currentConfig.checkPage });

                        if (reviewData && reviewData.success) {
                            if (reviewData.count > 0 && reviewData.lastReviewAt) {
                                // 날짜 필터링 (최근 N일 이내)
                                const cutoffDate = Date.now() - (currentConfig.reviewDays * 24 * 60 * 60 * 1000);

                                if (reviewData.lastReviewAt >= cutoffDate) {
                                    const resultEntry = {
                                        productId: product.productId,
                                        date: reviewData.lastReviewDate,
                                        url: detailUrl
                                    };

                                    allResults.push(resultEntry);
                                    processedIds.add(product.productId);

                                    fs.writeFileSync(currentConfig.resultFile, JSON.stringify(allResults, null, 2));
                                    sendStats(allResults.length);
                                    sendLog(`${progress} ✅ 성공: 최근 리뷰 확인됨. (총 저장: ${allResults.length})`);
                                } else {
                                    sendLog(`${progress} ⏩ 건너뜀: ${currentConfig.checkPage}페이지 리뷰가 너무 오래됨 (${reviewData.lastReviewDate})`);
                                }
                            } else {
                                sendLog(`${progress} ⏩ 건너뜀: ${currentConfig.checkPage}페이지에 리뷰가 없음.`);
                            }
                        } else {
                            // API 직접 호출 시 차단되었거나 에러가 났을 경우에만 상세 페이지로 fallback 방문
                            sendLog(`${progress} ⚠️ 백그라운드 API 호출 실패. 상세 페이지 우회 접속 시도 중...`);

                            await page.setExtraHTTPHeaders({
                                'Referer': lpUrl,
                                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                            });

                            await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

                            const body = await page.content();
                            if (body.includes('Access Denied') || body.includes('잠시 후 다시 시도해 주세요')) {
                                sendLog(`${progress} 🛑 차단됨! IP를 확인하거나 브라우저에서 캡차를 풀어주세요.`);
                                await delay(15000); // 차단 시 대기시간 증가
                                // 목록 페이지로 돌아가기
                                await page.goto(lpUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                                continue;
                            }

                            await delay(2000);
                            // 화면 전환 후 재시도
                            const retryReviewData = await page.evaluate(async ({ pid, targetPage }) => {
                                // ... retry logic ...
                                try {
                                    const apiUrl = `https://www.coupang.com/next-api/review?productId=${pid}&page=${targetPage}&size=10&sortBy=DATE_DESC&market=kr`;
                                    const response = await fetch(apiUrl, {
                                        headers: {
                                            'Accept': 'application/json, text/plain, */*',
                                            'Accept-Language': navigator.language || 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                                            'User-Agent': navigator.userAgent,
                                            'Referer': window.location.href,
                                            'Sec-Fetch-Dest': 'empty',
                                            'Sec-Fetch-Mode': 'cors',
                                            'Sec-Fetch-Site': 'same-origin',
                                            'Cache-Control': 'no-cache',
                                            'Pragma': 'no-cache'
                                        }
                                    });
                                    if (response.ok) {
                                        const data = await response.json();
                                        const contents = data.rData?.paging?.contents || [];
                                        if (contents.length > 0) {
                                            const last = contents[contents.length - 1];
                                            return {
                                                lastReviewAt: last.reviewAt ? new Date(last.reviewAt).getTime() : null,
                                                lastReviewDate: last.reviewAt ? new Date(last.reviewAt).toISOString().split('T')[0] : '',
                                            };
                                        }
                                    }
                                } catch (e) { }
                                return null;
                            }, { pid: product.productId, targetPage: currentConfig.checkPage });

                            if (retryReviewData && retryReviewData.lastReviewAt) {
                                const cutoffDate = Date.now() - (currentConfig.reviewDays * 24 * 60 * 60 * 1000);
                                if (retryReviewData.lastReviewAt >= cutoffDate) {
                                    const resultEntry = {
                                        productId: product.productId,
                                        date: retryReviewData.lastReviewDate,
                                        url: detailUrl
                                    };

                                    allResults.push(resultEntry);
                                    processedIds.add(product.productId);
                                    fs.writeFileSync(currentConfig.resultFile, JSON.stringify(allResults, null, 2));
                                    sendStats(allResults.length);
                                    sendLog(`${progress} ✅ 성공 (우회): 최근 리뷰 확인됨. (총 저장: ${allResults.length})`);
                                } else {
                                    sendLog(`${progress} ⏩ 건너뜀: ${currentConfig.checkPage}페이지 리뷰 너무 오래됨`);
                                }
                            } else {
                                sendLog(`${progress} ⏩ 건너뜀: ${currentConfig.checkPage}페이지에 리뷰 없음`);
                            }

                            // 상세 페이지 방문 후에는 다시 목록 페이지로 돌아가기
                            await page.goto(lpUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                        }

                    } catch (err) {
                        sendLog(`${progress} ❌ 상품 처리 중 오류 발생: ${err.message}`);
                    }

                    // 상품 간 랜덤 대기 (인간다운 패턴 유지)
                    const productWait = Math.floor(Math.random() * 4000) + 3000;
                    await delay(productWait);

                    // [개선 1] 주기적인 "긴 휴식" 패턴 적용 (사람이 쉬는 것처럼 위장)
                    sessionProcessedCount++;
                    if (sessionProcessedCount >= nextBreakCount && !isStopRequested) {
                        const restTime = Math.floor(Math.random() * 45000) + 45000; // 45초 ~ 90초 대기
                        sendLog(`\n[휴식] 봇 탐지를 회피하기 위해 사람처럼 잠시 화면을 멈춰둡니다... ☕ (${Math.floor(restTime / 1000)}초 대기)\n`);
                        await delay(restTime);
                        sessionProcessedCount = 0; // 카운트 초기화
                        nextBreakCount = Math.floor(Math.random() * 10) + 25; // 다음 휴식 목표 개수(25~34개) 재설정
                    }

                    // 이제 여기서 무조건 lpUrl로 다시 돌아가지 않습니다. (상세 페이지를 방문한 경우에만 위에서 돌아갔음)
                }

                // 목록 페이지 간 랜덤 대기
                if (!isStopRequested) {
                    const pageWait = Math.floor(Math.random() * 5000) + 3000;
                    await delay(pageWait);
                }
            }
        }

        if (isStopRequested) {
            sendLog(`\n🛑 [중단] 사용자가 크롤링을 강제로 중단했습니다.`);
        } else {
            sendLog(`\n${'='.repeat(80)}`);
            sendLog(`[완료] 통합 크롤러 실행 완료! 총 결과 수: ${allResults.length}`);
            sendLog(`${'='.repeat(80)}`);
        }

    } catch (error) {
        sendLog(`[치명적 오류] ${error.message}`);
    } finally {
        if (browser) {
            sendLog('[INFO] 브라우저 연결 종료 중...');
            await browser.close();
        }
    }
}
// --- Express Server Setup ---
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. 크롤링 시작 API
app.post('/api/start-crawl', async (req, res) => {
    const userConfig = req.body;
    isStopRequested = false; // 중단 플래그 리셋
    res.json({ success: true, message: '크롤링을 시작합니다.' });

    // 백그라운드에서 크롤링 실행
    try {
        await runUnifiedCrawl(userConfig);
    } catch (err) {
        sendLog(`[CRITICAL ERROR] ${err.message}`);
    }
});

// 2. 크롤링 중단 API
app.post('/api/stop-crawl', (req, res) => {
    isStopRequested = true;
    res.json({ success: true, message: '중단 요청을 보냈습니다. 현재 상품 처리 후 멈춥니다.' });
});

// 3. 결과 다운로드 API
app.get('/api/download-results', (req, res) => {
    const file = path.join(__dirname, CONFIG.resultFile);
    if (fs.existsSync(file)) {
        res.download(file);
    } else {
        res.status(404).json({ success: false, message: '결과 파일이 존재하지 않습니다.' });
    }
});

// 4. 데이터 초기화 API
app.post('/api/clear-results', (req, res) => {
    try {
        fs.writeFileSync(CONFIG.resultFile, JSON.stringify([], null, 2));
        sendStats(0); // 통계 초기화 전송
        sendLog('[SYSTEM] 데이터가 초기화되었습니다.');
        res.json({ success: true, message: '데이터가 성공적으로 초기화되었습니다.' });
    } catch (err) {
        res.status(500).json({ success: false, message: '데이터 초기화 실패' });
    }
});

// 5. 서버 종료 API
app.post('/api/shutdown', async (req, res) => {
    sendLog('[SYSTEM] 서비스를 종료합니다. 잠시 후 브라우저와 서버가 닫힙니다.');
    res.json({ success: true, message: '서비스가 곧 종료됩니다.' });

    // 안전한 종료를 위해 약간의 지연 후 프로세스 종료
    setTimeout(async () => {
        if (browser) {
            try { await browser.close(); } catch (e) { }
        }
        process.exit(0);
    }, 2000);
});

// 2. 실시간 로그 전송 API (SSE)
app.get('/api/logs', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // 접속 시 현재 건수 즉시 전송
    const initialConfig = { ...CONFIG };
    const currentResults = loadExistingResults(initialConfig.resultFile);
    res.write(`data: ${JSON.stringify({ type: 'stats', count: currentResults.length })}\n\n`);

    const logHandler = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    logEmitter.on('log', logHandler);

    req.on('close', () => {
        logEmitter.removeListener('log', logHandler);
    });
});

app.listen(PORT, () => {
    console.log(`\n🚀 [SERVER] 대시보드가 준비되었습니다!`);
    console.log(`👉 접속 주소: http://localhost:${PORT}\n`);
});