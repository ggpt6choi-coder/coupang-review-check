const { chromium } = require('playwright-extra');

(async () => {
    try {
        const browser = await chromium.connectOverCDP('http://localhost:9222');
        const context = browser.contexts()[0];
        const page = context.pages().find(p => p.url().includes('coupang.com/np/categories'));
        if (!page) {
            console.log("No category page found");
            process.exit(1);
        }

        const data = await page.evaluate(() => {
            const units = Array.from(document.querySelectorAll('.ProductUnit_productUnit__Qd6sv'));
            if (units.length === 0) return { error: 'No units found' };

            const firstUnit = units[0];
            const priceElem = firstUnit.querySelector('[class*="Price_priceValue"], [class*="PriceArea"], [class*="Price"]');

            return {
                html: priceElem ? priceElem.innerHTML : null,
                allPriceElementsClasses: Array.from(firstUnit.querySelectorAll('[class*="price"], [class*="Price"]')).map(e => e.className)
            };
        });

        console.log(JSON.stringify(data, null, 2));

        await browser.disconnect();
    } catch (e) {
        console.error(e);
    }
})();
