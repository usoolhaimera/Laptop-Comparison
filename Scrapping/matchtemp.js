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
    'predator','inspiron','latitude','envy','15','14'
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
  const match = lower.match(/(i[3579]|ryzen|amd athlon)/);
  return match ? match[0] : '';
}

function extractProcessorGeneration(name) {
  const lower = norm(name);

  // 1) Explicit “11th gen” or “12th generation” → return just “11” or “12”
  let match = lower.match(/(\d+)(?:st|nd|rd|th)\s*(?:gen(?:eration)?)/);
  if (match) {
    return match[1];
  }

  // 2) Intel model-number fallback, e.g. “i5-1135G7” → “11”
  match = lower.match(/i[3579][\s-]*([0-9]{2})[0-9]{3}/);
  if (match) {
    return match[1];
  }

  // 3) AMD Ryzen “Ryzen 5 5500U” → “ryzen 5”
  match = lower.match(/ryzen\s*(\d+)/);
  if (match) {
    return `ryzen ${match[1]}`;
  }

  // 4) Nothing found
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
    const match = lower.match(/touchscreen|touch\s*display/i);
    return match ? 'YES' : '';
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
      name:    extractProcessor(f.technicalDetails.Processor_Name) || extractProcessor(f.productName),
      gen:     extractProcessorGeneration(f.technicalDetails.Processor_Generation) || extractProcessorGeneration(f.productName)
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
      name:    extractProcessor(a.details.Processor_Type) || extractProcessor(title),
      gen:     extractProcessorGeneration(title)
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
  const flipkartPath = path.join(__dirname,'RemoveHp.json');
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
