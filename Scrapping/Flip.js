const puppeteer = require('puppeteer');
const fs = require('fs');

// Function to handle cookies/login popup
async function handleCookiesPopup(page) {
    try {
        const closeButton = await page.$('button._2KpZ6l._2doB4z');
        if (closeButton) {
            await closeButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.log('No popup found or error handling it');
    }
}

// Helper function for scrolling
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 200; // Scroll by a larger distance
            const scrollMaxAttempts = 30; // Limit scroll attempts
            let attempts = 0;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                attempts++;
                if (totalHeight >= scrollHeight || attempts >= scrollMaxAttempts) {
                    clearInterval(timer);
                    resolve();
                }
            }, 150); // Slightly longer interval
        });
    });
}

// Add this function to check if images have loaded
async function waitForImagesLoaded(page, timeout = 5000) {
    try {
        await page.waitForFunction(
            () => {
                const images = document.querySelectorAll('img[src*="rukminim"]');
                return Array.from(images).every(img => {
                    // Return true if image has loaded or has no src
                    return img.complete || !img.src;
                });
            },
            { timeout }
        );
        console.log("All images loaded successfully");
        return true;
    } catch (error) {
        console.log("Timeout waiting for images to load, continuing anyway");
        return false;
    }
}

// Function to get technical details and images from a product page
async function getProductDetails(browser, productUrl) {
    console.log(`Getting details for: ${productUrl}`);

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    // Add this right after creating a new page
    let imageUrlsFromNetwork = new Set();
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('rukminim') && url.includes('.jpeg') && response.status() === 200) {
            // Convert to high res url
            const highResUrl = url.replace(/\/\d+\/\d+\//, '/1664/1664/').replace(/\?q=\d+/, '?q=90');
            imageUrlsFromNetwork.add(highResUrl);
        }
    });

    try {
        // First load the product page
        await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        await handleCookiesPopup(page);

        // Make sure we're on the specifications tab
        const specPageUrl = productUrl.replace(/\/p\/([^?]+)/, '/p/$1/specifications');
        console.log(`Trying direct specifications URL: ${specPageUrl}`);

        // First try going directly to specs URL
        await page.goto(specPageUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // Check if we landed on a specs tab
        const onSpecsPage = await page.evaluate(() => {
            // Look for indicators that we're on a specs page
            const specIndicators = [
                document.querySelectorAll('table._14cfVK').length > 0,
                document.querySelectorAll('div._3k-BhJ').length > 0,
                document.querySelector('div.specs-content') !== null,
                document.querySelectorAll('table').length > 2,
                document.querySelector('.specifications-tab.active') !== null
            ];
            return specIndicators.some(indicator => indicator === true);
        });

        // If we're not on specs page, try clicking a specs tab
        if (!onSpecsPage) {
            console.log('Not on specs page, trying to click tabs...');

            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Click any tab that might lead to specs
            const clickedSpecTab = await page.evaluate(() => {
                const possibleTexts = ['specifications', 'specs', 'description', 'details'];
                const tabs = Array.from(document.querySelectorAll('div[role="tab"], li[role="tab"], a.Jc31hN, a._3QN6WI, div._3QN6WI'));

                for (const tab of tabs) {
                    const text = tab.textContent.toLowerCase();
                    if (possibleTexts.some(t => text.includes(t))) {
                        tab.click();
                        return true;
                    }
                }
                return false;
            });

            if (clickedSpecTab) {
                console.log('Clicked on a tab that might lead to specs');
                await new Promise(resolve => setTimeout(resolve, 3000)); // Longer wait
            }
        }

        await autoScroll(page);

        // Add this right after you navigate to the specs tab
        await page.evaluate(() => {
            // Check what's actually available on the page
            console.log("DEBUG: Available spec containers:", {
                tables: document.querySelectorAll('table').length,
                specTables: document.querySelectorAll('table._14cfVK').length,
                specDivs: document.querySelectorAll('div._3k-BhJ').length,
                generalDivs: document.querySelectorAll('[class*="spec"]').length
            });
        });

        // Replace your specification extraction code with this more robust version
        const technicalDetails = await page.evaluate(() => {
            const details = {};
            const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : '';

            // APPROACH 1: Specific Flipkart selectors - combined with more generic pattern matching
            const allTables = document.querySelectorAll('table');
            console.log(`Found ${allTables.length} tables on the page`);

            // Process all tables on the page that look like spec tables
            allTables.forEach(table => {
                const rows = table.querySelectorAll('tr');
                // Only consider tables with rows
                if (rows.length > 0) {
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td, th');
                        if (cells.length >= 2) {
                            const key = cleanText(cells[0].textContent);
                            const value = cleanText(cells[1].textContent);
                            if (key && value && key.length < 100 && value.length < 500) {
                                details[key] = value;
                            }
                        }
                    });
                }
            });

            // APPROACH 2: Look for typical key:value patterns in any elements
            const specContainers = document.querySelectorAll('div[class*="spec"], div[class*="Spec"], section[class*="spec"], div._3k-BhJ');
            specContainers.forEach(container => {
                const keyElements = container.querySelectorAll('[class*="key"], [class*="Key"], [class*="label"], [class*="Label"], th');
                const valueElements = container.querySelectorAll('[class*="value"], [class*="Value"], [class*="data"], [class*="Data"], td');

                for (let i = 0; i < Math.min(keyElements.length, valueElements.length); i++) {
                    const key = cleanText(keyElements[i].textContent);
                    const value = cleanText(valueElements[i].textContent);
                    if (key && value && !details[key]) {
                        details[key] = value;
                    }
                }
            });

            // APPROACH 3: Try to find any elements that look like labels/values
            if (Object.keys(details).length < 3) {
                // Looser pattern matching for key:value pairs
                const allElements = document.querySelectorAll('div, li, p, span');
                allElements.forEach(el => {
                    const text = el.textContent;
                    if (text && text.includes(':')) {
                        const parts = text.split(':', 2);
                        if (parts.length === 2) {
                            const key = cleanText(parts[0]);
                            const value = cleanText(parts[1]);
                            // Only add if it looks like a specification (not too long, not emails, etc)
                            if (key && value && key.length < 50 && value.length < 200 &&
                                !key.includes('@') && !value.includes('@') &&
                                !key.includes('http') && !value.includes('http')) {
                                details[key] = value;
                            }
                        }
                    }
                });
            }

            // Get basic product info
            const titleElement = document.querySelector('.B_NuCI, .yhB1nd, h1._6EB75A, [class*="title"], [class*="Title"]');
            if (titleElement) {
                details['Product Name'] = cleanText(titleElement.textContent);
            }

            return details;
        });

        // Add this improved image extraction function to your getProductDetails function
        async function extractAllProductImages(page, productUrl) {
            console.log(`Extracting all images for: ${productUrl}`);

            // First try the direct approach - get images without clicking
            let imageLinks = await page.evaluate(() => {
                const urls = new Set();

                // Helper to convert to high-res
                const getHighResUrl = (url) => {
                    if (!url || typeof url !== 'string' || url.startsWith('data:')) return null;
                    // Convert to highest resolution
                    let highResUrl = url.replace(/\/\d+\/\d+\//, '/1664/1664/').replace(/\?q=\d+/, '?q=90');
                    if (highResUrl.startsWith('//')) highResUrl = 'https:' + highResUrl;
                    return highResUrl;
                };

                // Get all image elements
                const allImages = document.querySelectorAll('img[src*="rukminim"]');
                allImages.forEach(img => {
                    if (img.src && (img.width > 100 || img.height > 100)) {
                        const highResUrl = getHighResUrl(img.src);
                        if (highResUrl) urls.add(highResUrl);
                    }
                });

                return Array.from(urls);
            });

            if (imageLinks.length >= 5) {
                console.log(`Found ${imageLinks.length} images with static extraction`);
                return imageLinks;
            }

            // If we need more images, try the interactive approach
            console.log("Using interactive approach to get all images...");

            // Make sure we're on the product page
            await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await waitForImagesLoaded(page, 3000);
            await page.waitForTimeout(2000);

            // Try to extract images using the thumbnail navigation
            const interactiveImages = await page.evaluate(async () => {
                const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
                const allImageUrls = new Set();

                // Helper for high-res images
                const getHighResUrl = (url) => {
                    if (!url || typeof url !== 'string' || url.startsWith('data:')) return null;
                    let highResUrl = url.replace(/\/\d+\/\d+\//, '/1664/1664/').replace(/\?q=\d+/, '?q=90');
                    if (highResUrl.startsWith('//')) highResUrl = 'https:' + highResUrl;
                    return highResUrl;
                };

                // Function to extract current visible image
                const extractCurrentVisibleImage = () => {
                    // Try all possible selectors for the main product image
                    const mainImageSelectors = [
                        'img.DByuf4.IZexXJ',
                        'img._396cs4',
                        'img[src*="rukminim"][width="500"]',
                        'div._3nMexc img',
                        'div._4WELSP img',
                        '.CXW8mj img'
                    ];

                    for (const selector of mainImageSelectors) {
                        const img = document.querySelector(selector);
                        if (img && img.src) {
                            const highResUrl = getHighResUrl(img.src);
                            if (highResUrl) allImageUrls.add(highResUrl);
                        }
                    }
                };

                // First check if we have the exact thumbnail structure from the HTML
                const thumbsContainer = document.querySelector('ul.ZqtVYK');
                if (thumbsContainer) {
                    console.log("Found thumbnail container with ZqtVYK class");
                    const thumbDivs = thumbsContainer.querySelectorAll('li.YGoYIP div.HXf4Qp');
                    console.log(`Found ${thumbDivs.length} thumbnail divs`);

                    // First extract the current visible image
                    extractCurrentVisibleImage();

                    // Click each thumbnail and extract its image
                    for (let i = 0; i < thumbDivs.length; i++) {
                        try {
                            console.log(`Clicking thumbnail ${i + 1}/${thumbDivs.length}`);
                            thumbDivs[i].click();
                            await sleep(800); // Wait for image to load
                            extractCurrentVisibleImage();
                        } catch (e) {
                            console.log(`Error clicking thumbnail ${i + 1}: ${e.message}`);
                        }
                    }
                }
                // Fallback to alternative thumbnail structures
                else {
                    console.log("Using fallback thumbnail detection");

                    // Extract current visible image first
                    extractCurrentVisibleImage();

                    // Try various selector patterns for thumbnails
                    const thumbnailSelectors = [
                        'div[class*="thumbnail"] img',
                        'ul[class*="thumbnail"] li img',
                        'div[class*="thumb"] img',
                        'ul[class*="thumb"] li img',
                        'div.q6DClP',
                        'li._20Gt85 div',
                        'img._0DkuPH'
                    ];

                    // Find the right selector that gives us thumbnails
                    let thumbnails = [];
                    for (const selector of thumbnailSelectors) {
                        const elements = document.querySelectorAll(selector);
                        if (elements.length > 1) {
                            console.log(`Found ${elements.length} thumbnails with selector: ${selector}`);
                            thumbnails = Array.from(elements);
                            break;
                        }
                    }

                    // Click each thumbnail and extract image
                    for (let i = 0; i < thumbnails.length; i++) {
                        try {
                            console.log(`Clicking alternative thumbnail ${i + 1}/${thumbnails.length}`);
                            thumbnails[i].click();
                            await sleep(800);
                            extractCurrentVisibleImage();
                        } catch (e) {
                            console.log(`Error with alternative thumbnail ${i + 1}: ${e.message}`);
                        }
                    }

                    // If still no thumbnails found, try parent elements that might be clickable
                    if (thumbnails.length === 0) {
                        const smallImages = document.querySelectorAll('img[width="64"], img[width="128"]');
                        console.log(`Found ${smallImages.length} small images that might be thumbnails`);

                        for (let i = 0; i < smallImages.length; i++) {
                            try {
                                // Try clicking the parent element instead
                                const clickTarget = smallImages[i].closest('div') || smallImages[i];
                                clickTarget.click();
                                await sleep(800);
                                extractCurrentVisibleImage();
                            } catch (e) {
                                console.log(`Error with small image ${i + 1}: ${e.message}`);
                            }
                        }
                    }
                }

                // Final fallback - just get all images on the page
                if (allImageUrls.size < 3) {
                    document.querySelectorAll('img[src*="rukminim"]').forEach(img => {
                        if (img.width > 200 || img.height > 200) {
                            const highResUrl = getHighResUrl(img.src);
                            if (highResUrl) allImageUrls.add(highResUrl);
                        }
                    });
                }

                return Array.from(allImageUrls);
            });

            console.log(`Found ${interactiveImages.length} images with interactive extraction`);

            // Combine both approaches and remove duplicates
            const allImages = [...new Set([...imageLinks, ...interactiveImages])];
            console.log(`Total unique images: ${allImages.length}`);

            return allImages;
        }

        // Add this to your getProductDetails function
        // Replace your existing image extraction code with this:

        // Extract all product images
        const imageLinks = await extractAllProductImages(page, productUrl);
        console.log(`Found ${imageLinks.length} product images`);

        // Limit to 10 images
        technicalDetails.imageLinks = imageLinks.slice(0, 10);

        // Log the extracted specifications count
        console.log(`Extracted ${Object.keys(technicalDetails).length} specifications`);

        // At the end of your getProductDetails function, before returning results:
        // If we didn't get any specs, at least get the title/price/description
        if (Object.keys(technicalDetails).length < 3) {
            console.log("Few specifications found, adding basic product info...");

            // Go back to main product page
            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 60000 });

            // Extract basic info
            const basicDetails = await page.evaluate(() => {
                const cleanText = text => text ? text.replace(/\s+/g, ' ').trim() : '';
                const details = {};

                // Product title
                const titleEl = document.querySelector('.B_NuCI, h1[class*="title"], h1');
                if (titleEl) details['Product Name'] = cleanText(titleEl.textContent);

                // Price
                const priceEl = document.querySelector('._30jeq3, [class*="price"], .CEmiEU');
                if (priceEl) details['Price'] = cleanText(priceEl.textContent);

                // Description
                const descEl = document.querySelector('div[class*="description"], div._1mXcCf, p[class*="text"]');
                if (descEl) details['Description'] = cleanText(descEl.textContent);

                // Highlights
                const highlights = Array.from(document.querySelectorAll('div._2418kt li, ul._21Ahn- li'))
                    .map(el => cleanText(el.textContent))
                    .filter(Boolean);

                if (highlights.length > 0) {
                    details['Highlights'] = highlights.join(' | ');
                }

                return details;
            });

            // Merge with our existing details
            Object.assign(technicalDetails, basicDetails);
        }

        await page.close();
        return technicalDetails;

    } catch (error) {
        console.error(`Error in getProductDetails for ${productUrl}: ${error.message}`);
        if (page && !page.isClosed()) {
            await page.close();
        }
        return { error: error.message, imageLinks: [] };
    }
}

// Update scrapeFlipkart function to remove screenshots
async function scrapeFlipkart() {
    const browser = await puppeteer.launch({
        headless: 'new', // Use headless for speed
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage', // Prevents crashes when taking screenshots
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080'
        ],
        defaultViewport: {
            width: 1280,
            height: 800
        }
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    try {
        const homeUrl = "https://www.flipkart.com/search?q=laptop&otracker=search&otracker1=search&marketplace=FLIPKART&as-show=on&as=off&as-pos=1&as-type=HISTORY&p%5B%5D=facets.brand%255B%255D%3DREDMI&p%5B%5D=facets.brand%255B%255D%3DMSI&p%5B%5D=facets.brand%255B%255D%3DAvita&p%5B%5D=facets.brand%255B%255D%3DHP&p%5B%5D=facets.brand%255B%255D%3DASUS&p%5B%5D=facets.brand%255B%255D%3DLenovo&p%5B%5D=facets.brand%255B%255D%3DDELL&p%5B%5D=facets.brand%255B%255D%3DMi&p%5B%5D=facets.brand%255B%255D%3DAcer&p%5B%5D=facets.brand%255B%255D%3DApple&p%5B%5D=facets.brand%255B%255D%3DInfinix&p%5B%5D=facets.brand%255B%255D%3DSAMSUNG&p%5B%5D=facets.brand%255B%255D%3DMICROSOFT&p%5B%5D=facets.brand%255B%255D%3DZEBRONICS&p%5B%5D=facets.brand%255B%255D%3DGIGABYTE&p%5B%5D=facets.brand%255B%255D%3DPrimebook&p%5B%5D=facets.brand%255B%255D%3DVaio&p%5B%5D=facets.brand%255B%255D%3DUltimus&p%5B%5D=facets.brand%255B%255D%3DMOTOROLA&p%5B%5D=facets.brand%255B%255D%3DCHUWI&p%5B%5D=facets.brand%255B%255D%3DALIENWARE&p%5B%5D=facets.brand%255B%255D%3DColorful&p%5B%5D=facets.brand%255B%255D%3DThomson&p%5B%5D=facets.brand%255B%255D%3DWarnerCann&p%5B%5D=facets.brand%255B%255D%3DWINGS&p%5B%5D=facets.brand%255B%255D%3DAXL&p%5B%5D=facets.brand%255B%255D%3Dwalker&p%5B%5D=facets.brand%255B%255D%3DFUTOPIA";
        await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await handleCookiesPopup(page);

        // go to different page
        const urlHp="https://www.flipkart.com/search?q=laptop&otracker=search&otracker1=search&marketplace=FLIPKART&as-show=on&as=off&as-pos=1&as-type=HISTORY&sort=popularity&p%5B%5D=facets.brand%255B%255D%3DHP"
        await page.goto(urlHp, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await handleCookiesPopup(page);


        const url = page.url();
        const cardData = [];

        async function scrapePage(currentPageUrl, currentPageNum = 1, scrapeToPage = 2) {
            console.log("Scraping page " + currentPageNum + " ...");
            if (scrapeToPage !== null && currentPageNum > scrapeToPage) {
                return;
            }

            if (currentPageNum > 1) {
                await page.goto(currentPageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            }
            await handleCookiesPopup(page);
            await new Promise(resolve => setTimeout(resolve, 3000));

            const pageCardData = await page.evaluate(() => {
                const productCards = document.querySelectorAll('div.tUxRFH, a.CGtC98, div._1AtVbE');
                const items = [];
                productCards.forEach(card => {
                    let linkElement = card.tagName === 'A' ? card : card.querySelector('a.CGtC98, a._1fQZEK');
                    let productLink = "N/A", productId = "unknown", cleanProductLink = "N/A";

                    if (linkElement && linkElement.href) {
                        productLink = linkElement.href;
                        const pidMatch = productLink.match(/pid=([A-Za-z0-9]+)/i);
                        if (pidMatch) {
                            productId = pidMatch[1];
                            cleanProductLink = `https://www.flipkart.com${linkElement.pathname}`;
                        }
                    }

                    const nameElement = card.querySelector('.KzDlHZ, ._4rR01T, .s1Q9rs');
                    const productName = nameElement ? nameElement.textContent.trim() : "N/A";
                    if (productName === "N/A" && !productLink.includes("/p/")) return null;

                    const priceElement = card.querySelector('.Nx9bqj._4b5DiR, ._30jeq3');
                    const price = priceElement ? priceElement.textContent.trim() : "N/A";
                    const basePriceElement = card.querySelector('.yRaY8j.ZYYwLA, ._3I9_wc');
                    const basePrice = basePriceElement ? basePriceElement.textContent.trim() : "N/A";
                    const ratingElement = card.querySelector('.XQDdHH, ._3LWZlK');
                    let rating = "N/A";
                    if (ratingElement) {
                        const ratingMatch = ratingElement.textContent.trim().match(/^(\d+(\.\d+)?)/);
                        rating = ratingMatch ? ratingMatch[1] : ratingElement.textContent.trim();
                    }
                    const ratingsElement = card.querySelector('.Wphh3N, ._2_R_DZ');
                    let ratingsNumber = "N/A";
                    if (ratingsElement) {
                        const match = ratingsElement.textContent.trim().match(/(\d[\d,]*)\s+Ratings/);
                        ratingsNumber = match ? match[1] : "N/A";
                    }
                    const badgeElement = card.querySelector('.UkUFwK');
                    const badge = badgeElement ? badgeElement.textContent.trim() : "N/A";

                    items.push({
                        productName, productLink, cleanProductLink, productId,
                        sponsored: "no", badge, price, basePrice, rating, ratingsNumber,
                        boughtPastMonth: "N/A"
                    });
                });
                return items.filter(card => card !== null && card.productLink !== "N/A");
            });

            console.log(`Found ${pageCardData.length} products on page ${currentPageNum}`);
            cardData.push(...pageCardData);

            if (scrapeToPage === null || currentPageNum < scrapeToPage) {
                const nextPageButtonUrl = await page.evaluate(() => {
                    const nextButtons = Array.from(document.querySelectorAll('a._1LKTO3, nav a span'));
                    const nextLink = nextButtons.find(btn => btn.textContent.trim().toLowerCase() === 'next');
                    return nextLink ? (nextLink.closest('a') ? nextLink.closest('a').href : null) : null;
                });

                if (nextPageButtonUrl) {
                    console.log('Next Page URL:', nextPageButtonUrl);
                    await scrapePage(nextPageButtonUrl, currentPageNum + 1, scrapeToPage);
                } else {
                    console.log("No 'Next' button found or all available pages scraped:", currentPageNum);
                }
            }
        }

        await scrapePage(url, 1, 1);

        console.log('Basic scraping finished. Getting product details...');
        const enhancedData = [];
        const validProducts = cardData.filter(product => product.productLink && product.productLink !== "N/A");
        console.log(`Found ${validProducts.length} products with valid links out of ${cardData.length} total`);

        //
        const productsToProcess = validProducts;

        for (let i = 0; i < productsToProcess.length; i++) {
            const product = productsToProcess[i];
            console.log(`Processing product ${i + 1}/${productsToProcess.length}: ${product.productName} (${product.productLink})`);
            try {
                const productDetails = await getProductDetails(browser, product.productLink);
                const enhancedProduct = { ...product, technicalDetails: productDetails };
                enhancedData.push(enhancedProduct);
                fs.writeFileSync('scrapedDataF.json', JSON.stringify(enhancedData, null, 2), 'utf8');
                console.log(`Progress saved for product ${i + 1}`);
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));
            } catch (error) {
                console.error(`Error processing product ${product.productName}: ${error.message}`);
                enhancedData.push({ ...product, technicalDetails: { error: error.message, imageLinks: [] } });
            }
        }

        console.log('All processing complete.');

    } catch (error) {
        console.error('Scraping error in scrapeFlipkart:', error);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

scrapeFlipkart()
    .then(() => console.log('Scraping completed successfully.'))
    .catch(err => console.error('Main execution error:', err));