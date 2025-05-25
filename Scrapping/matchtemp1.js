// matchLaptops.js

const fs   = require('fs');
const path = require('path');

// --- Utilities ---
const norm       = s => (s || '').toString().toLowerCase().trim();
const stripUnits = s => (s || '').toString().replace(/(gb|tb|cm|inch|")/gi, '').trim();

function extractSeries(name) {
  const keywords = [
    'legion','ideapad','thinkpad', 'victus 15', 'victus','omen', 'pavilion x360', 'pavilion','aspire',
    'nitro 5','nitro v',  'elitebook', 'zbook', 'v15','v14', '15s','professional','one','yoga',
    'yogabook','chromebook', '240 G9', '14s',  '255 g8','255 g9','255 g10','zbook','fire fly',
    'spectre x360','probook','alienware','vivobook','zenbook','rog','tuf',
    'predator','inspiron','latitude','envy','spectre','15','14',

    //Acer
     'Swift Go 14',' Swift 14','Swift 3','Swift X','swift','travelmate','extensa','spin','chromebook','predator helios','predator triton',

  ];
  const lower = norm(name);
  for (let kw of keywords) {
    if (lower.includes(kw)) return kw;
  }
  return '';
}

function extractModel(name) {
  const lower = norm(name);
  const match = lower.match(/(lenovo|hp|asus|acer|dell|msi|apple)/);
  return match ? match[0] : '';
}

function extractProcessor(name) {
  const lower = norm(name);

  // Intel Core Ultra 5/7/9
  let match = lower.match(/core\s+ultra\s*([579])/);
  if (match) return `core ultra ${match[1]}`;

  // Intel i3, i5, i7, i9
  match = lower.match(/\bi[3579]\b/);
  if (match) return match[0];

  // AMD Ryzen 3/5/7/9
  match = lower.match(/ryzen\s*([3579])/);
  if (match) return `ryzen`;

  // AMD Athlon
  match = lower.match(/amd\s+athlon/);
  if (match) return 'athlon';

  // Apple M1/M2/M3
  match = lower.match(/m[123]/);
  if (match) return match[0];

  // Apple A-series
  match = lower.match(/apple\s+a(\d+)/);
  if (match) return `a${match[1]}`;

  // Celeron
  match = lower.match(/celeron/);
  if (match) return 'celeron';

  // Pentium
  match = lower.match(/pentium\s*(gold|silver)?/);
  if (match) return 'pentium';

  // Snapdragon
  match = lower.match(/snapdragon/);
  if (match) return 'snapdragon';

  // MediaTek
  match = lower.match(/mediatek|mt\d+/);
  if (match) return 'mediatek';

  // Exynos
  match = lower.match(/exynos/);
  if (match) return 'exynos';

  // ARM Cortex
  match = lower.match(/arm\s*cortex[-\s]*([a-z\d]+)/);
  if (match) return `cortex-${match[1]}`;

  return '';
}



function extractProcessorGeneration(name) {
  const lower = norm(name);

  // 0. Intel Core Ultra — match "155H" → generation 15
// match = lower.match(/core\s+ultra\s+[579]?\s*(\d{3})/);
// if (match) return match[1][0] + match[1][1]; // e.g., "155" → "15"

  // 1. Match “11th gen”, “12th generation” etc.
  let match = lower.match(/(\d+)(?:st|nd|rd|th)?\s*(?:gen(?:eration)?)/);
  if (match) return match[1];

  // 2. Intel i5-1135G7 → generation from model number
  match = lower.match(/i[3579][\s-]*([0-9]{2})[0-9]{2}[a-z]?/);
  if (match) return match[1];

  // 3. Ryzen 5 5500U → get first digit of model
  match = lower.match(/ryzen\s*[3579]\s*([0-9]{4})/);
  if (match) return match[1][0]; // e.g., '5' from '5500'

  // 4. Apple M1/M2/M3
  match = lower.match(/apple\s*m([123])/);
  if (match) return `M${match[1]}`;

  // 5. Apple A-series
  match = lower.match(/apple\s*a(\d+)/);
  if (match) return `A${match[1]}`;

  // 6. Snapdragon/Exynos/MediaTek version
  match = lower.match(/(snapdragon|exynos|mt|mediatek)[\s\-]*(\d+)/);
  if (match) return match[2];

  // 7. ARM Cortex variant
  match = lower.match(/arm\s*cortex[-\s]*([a-z\d]+)/);
  if (match) return match[1];

  return '';
}
function extractProcessorVariant(name) {
  if (!name) return '';
  
  const normalized = name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Check for AMD Ryzen variants
  let match = normalized.match(/ryzen\s*[3579]\s*(?:pro\s*)?.*?(\d{3,4}(?:x3d|xt|ge|hs|hx|h|u|g|x|s)?)/i);
  if (match) return match[1].toUpperCase();
  
  // Check for Intel variants
  match = normalized.match(/(core\s+(?:ultra\s*)?)(i[3579]|ultra\s*[579]|pentium|celeron)\s*.*?(\d{3,5}(?:[a-z]{1,2})?)/i);
  if (match) return match[3].toUpperCase();
  
  return '';
}

function extractRamFromName(name) {
  const lower = norm(name);
  const match = lower.match(/(8|16|32|\d{4}mb)/);
  return match ? match[0] : '';
}

function extractRam(name) {
  const lower = norm(name); 
  const match = lower.match(/(4|8|16|32|\d{4}mb)/);
  return match ? match[0] : '';
}
function extractStorage(name) {
  const lower = norm(name);
  const match = lower.match(/(\d{3,4}gb|\d{2}tb)/);
  return match ? match[0] : '';
}

function extractGpu(name) {
  const lower = norm(name);
  const match = lower.match(/(gtx|rtx|radeon|intel)/);
  return match ? match[0] : '';
}

function extractTouchScreen(name) { 
    const lower = norm(name);
    const match = lower.match(/touchscreen|YES|touch\s*display/i);
    return match ? 'YES' : '';
}

function extractProcessorGenFromProductName(productName) {
  if (!productName) return null;

  const variant = extractProcessorVariant(productName);
  if (!variant) return null;

 const normalized = variant.toLowerCase().trim();
  
  // AMD Ryzen pattern (7320U should return "7" not "73")
  if (/^\d\d\d\d[a-z]*$/.test(normalized)) {
    return normalized.charAt(0); // Just take the first character
  }
  
  // Intel Core pattern (11th gen, 12th gen, etc.)
  let match = normalized.match(/^(\d{1,2})\d{2,3}[a-z]*$/);
  if (match) return match[1];
  
  // Intel N-series
  match = normalized.match(/^n(\d)\d{2}$/);
  if (match) return `N${match[1]}`;
  
  return '';
  

}


// --- Normalizers ---
function normalizeFlipkart(f) {
  const t = f.technicalDetails || {};
  const hasSSD      = (t.SSD || '').toLowerCase() === 'yes';
  const storageSize = hasSSD
    ? stripUnits(t['SSD Capacity'])
    : stripUnits(t['EMMC Storage Capacity']);
  const storageType = hasSSD ? 'ssd' : norm(t['Storage Type']);
  const dispMatch   = (t['Screen Size'] || '').match(/\(([\d.]+)\s*inch\)/i);

  return {
    brand:       extractModel(f.productName),
    series:      extractSeries(f.technicalDetails.Series) || extractSeries(f.productName),
    processor: {
      name:    extractProcessor(f.technicalDetails["Processor Name"]) || extractProcessor(f.productName),
      gen:     extractProcessorGeneration(f.technicalDetails["Processor Generation"]) || extractProcessorGenFromProductName(f.productName),
      variant: extractProcessorVariant(f.technicalDetails["Processor Variant"]) || extractProcessorVariant(f.productName)
    },
    ram: {
      size: extractRam(f.technicalDetails.RAM) || extractRam(f.productName)
    },
    storage: {
      size: storageSize,
      type: storageType
    },
    touch: extractTouchScreen(f.productName) || extractTouchScreen(f.technicalDetails.Touchscreen),
    displayInch: dispMatch ? parseFloat(dispMatch[1]) : null,
    gpu:         extractGpu(f.productName),
    price:       Number((f.price || '').replace(/[^0-9]/g,'')),  // stored but not matched on
    link:        f.productLink || f.cleanProductLink,
    rating:      Number(f.rating || 0)
  };
}

function normalizeAmazon(a) {
  const d = a.details || {};
  const storageSize = stripUnits(d['Hard Drive Size']);
  const storageType = norm(d['Hard Disk Description']);
  const disp         = stripUnits(d['Standing screen display size']);
  const title        = a.title || '';

  return {
    brand:  extractModel(title),
    series: extractSeries(title),
    processor: {
      name:    extractProcessor(a.details["Processor Type"]) || extractProcessor(title),
      gen:     extractProcessorGeneration(title) || extractProcessorGenFromProductName(title),
      variant: extractProcessorVariant(title) || extractProcessorVariant(a.details["Product Name"])
    },
    ram: {
      size: extractRam(d.RAM_Size) || extractRamFromName(title)
    },
    storage: {
      size: storageSize,
      type: storageType
    },
    touch: extractTouchScreen(title) || extractTouchScreen(d['Touchscreen']),
    displayInch: parseFloat(disp) || null,
    gpu:         extractGpu(title),
    price:       Number((a.price || '').replace(/[^0-9]/g,'')),
    link:        a.url,
    rating:      Number(a.rating || 0)
  };
}

// --- Matching Key ---
function makeKey(lap) {
  return [
    lap.brand,
    lap.series,
    lap.processor.name,
    lap.processor.gen,
    lap.processor.variant,
    lap.ram.size,
    lap.storage.size,
    lap.storage.type,
    lap.Touchscreen,
    lap.gpu

  ].join('|');
}
// --- Build & Split Entries ---
function buildEntries(amz, fk) {
  // 1) build Flipkart buckets
  const fkMap = new Map();
  fk.forEach(item => {
    const normF = normalizeFlipkart(item);
    const key   = makeKey(normF);
    if (!fkMap.has(key)) fkMap.set(key, []);
    fkMap.get(key).push({ ...normF, _matched:false });
  });

  // prepare arrays
  const matched       = [];
  const amazonOnly    = [];
  const flipkartOnly  = [];

  // 2) match Amazon → Flipkart[]
  amz.forEach(item => {
    const normA = normalizeAmazon(item);
    const key   = makeKey(normA);
    const bucket= fkMap.get(key)||[];

    if (bucket.length) {
      // one entry per Flipkart match
      bucket.forEach(fkRec => {
        fkRec._matched = true;
        matched.push({
          brand:  normA.brand,
          series: normA.series,
          specs:  { ...normA, price:undefined, link:undefined, rating:undefined },
          sites: [
            { source:'amazon',   price:normA.price,   link:normA.link,   rating:normA.rating },
            { source:'flipkart', price:fkRec.price,    link:fkRec.link,    rating:fkRec.rating }
          ]
        });
      });
    } else {
      // no match → amazon-only
      amazonOnly.push({
        brand:  normA.brand,
        series: normA.series,
        specs:  { ...normA, price:undefined, link:undefined, rating:undefined },
        sites:  [{ source:'amazon', price:normA.price, link:normA.link, rating:normA.rating }]
      });
    }
  });

  // 3) collect any Flipkart-only
  fkMap.forEach(bucket => {
    bucket.forEach(fkRec => {
      if (!fkRec._matched) {
        flipkartOnly.push({
          brand:  fkRec.brand,
          series: fkRec.series,
          specs:  { ...fkRec, price:undefined, link:undefined, rating:undefined },
          sites:  [{ source:'flipkart', price:fkRec.price, link:fkRec.link, rating:fkRec.rating }]
        });
      }
    });
  });

  return { matched, amazonOnly, flipkartOnly };
}

// --- Main ---
(function(){
  // load data
  const amazonPath   = path.join(__dirname,'amazon_complete_final.json');
  const flipkartPath = path.join(__dirname,'./Flipkart/RemoveHp.json');
  const amazonData   = JSON.parse(fs.readFileSync(amazonPath,'utf-8'));
  const flipkartData = JSON.parse(fs.readFileSync(flipkartPath,'utf-8'));

  // build
  const { matched, amazonOnly, flipkartOnly } = buildEntries(amazonData, flipkartData);
  const finalAll = matched.concat(amazonOnly, flipkartOnly);

  // write files
  fs.writeFileSync('matched_laptops.json',       JSON.stringify(matched,        null,2), 'utf-8');
  fs.writeFileSync('amazon_only_laptops.json',   JSON.stringify(amazonOnly,     null,2), 'utf-8');
  fs.writeFileSync('flipkart_only_laptops.json', JSON.stringify(flipkartOnly,   null,2), 'utf-8');
  fs.writeFileSync('final_laptops.json',         JSON.stringify(finalAll,       null,2), 'utf-8');

  // log stats
  console.log(`✅ Matched: ${matched.length}`);
  console.log(`❌ Amazon-only: ${amazonOnly.length}`);
  console.log(`❌ Flipkart-only: ${flipkartOnly.length}`);
  console.log(`📦 Total entries: ${finalAll.length}`);
})();
