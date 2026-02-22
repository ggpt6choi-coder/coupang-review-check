const { chromium } = require('playwright-extra');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const context = browser.contexts()[0];
        const page = context.pages().find(p => p.url().includes('coupang.com/np/categories'));

        const data = await page.evaluate(() => {
            const units = Array.from(document.querySelectorAll('[class*="ProductUnit_productUnit"]'));
            return units.map(unit => {
                // Let's find all text nodes that match \d+,\d+원
                const walker = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT, null, false);
                const prices = [];
                let node;
                while (node = walker.nextNode()) {
                    if (node.nodeValue.includes('원')) {
                        let text = node.nodeValue.trim();
                        if (text.match(/^[0-9,]+원$/)) {
                            // Check parent tagName to avoid <del>
                            if (node.parentElement && node.parentElement.tagName !== 'DEL') {
                                prices.push(text);
                            }
                        }
                    }
                }

                return {
                    prices: prices,
                    priceElemHtml: unit.querySelector('[class*="PriceArea_"]') ? unit.querySelector('[class*="PriceArea_"]').innerText : null
                };
            }).slice(0, 10);
        });

        console.log(JSON.stringify(data, null, 2));

        await browser.disconnect();
    } catch (e) {
        console.error(e);
    }
})();
