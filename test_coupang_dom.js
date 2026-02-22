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
            const products = Array.from(document.querySelectorAll('li.baby-product, .baby-product'));
            const aTags = Array.from(document.querySelectorAll('a[href*="/vp/products/"]'));

            return {
                url: window.location.href,
                liCount: products.length,
                aTagCount: aTags.length,
                sampleLiHtml: products.length > 0 ? products[0].innerHTML.substring(0, 300) : '',
                sampleATagHtml: aTags.length > 0 ? aTags[0].outerHTML.substring(0, 300) : '',
                sampleATagParentClass: aTags.length > 0 ? (aTags[0].parentElement ? aTags[0].parentElement.className : '') : ''
            };
        });

        console.log("DOM Search Result:");
        console.log(JSON.stringify(data, null, 2));

        // Let's also test the original selector
        const origProducts = await page.evaluate(() => {
            return document.querySelectorAll('.ProductUnit_productUnit__Qd6sv').length;
        });
        console.log("Original selector count: .ProductUnit_productUnit__Qd6sv ->", origProducts);

        const newWayCount = await page.evaluate(() => {
            return document.querySelectorAll('.baby-product .price-value').length;
        });
        console.log("New way count: .baby-product .price-value ->", newWayCount);

        // Disconnect instead of close, so we don't kill the user's browser.
        await browser.disconnect();
    } catch (e) {
        console.error(e);
    }
})();
