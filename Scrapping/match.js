// matchLaptops.js

const fs   = require('fs');
const path = require('path');

// --- Utilities ---
const norm       = s => (s || '').toString().toLowerCase().trim();
const stripUnits = s => (s || '').toString().replace(/(gb|tb|cm|inch|")/gi, '').trim();

function extractSeries(name) {
  const keywords = [
    'legion','ideapad','thinkpad','victus','omen','pavilion','aspire', 'nitro 5', 'nitro v',
    '15', 'professional', 'v15', 'v14', '14', 'thinkbook', 'one', 'yoga', 'yogabook', 'loq',
    'chromebook', '255 g8', '255 g9', '255 g10', 'zbook', 'fire fly', 'spectre x360', 
    'probook 440 9', '440 g9', 'probook', 'alienware',
    'vivobook','zenbook','rog','tuf','predator','inspiron','latitude','envy'
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
  if (match) {
    return match[0];
  }
  return '';
}

function extractProcessor(name) {
  const lower = norm(name); 
    const match = lower.match(/(i\d|ryzen)/);
    if (match) {    
        return match[0];
        }   
    return '';
}

function extractProcessorGeneration(name) {
  const lower = norm(name);
  
  // Check for explicit Intel generation mentions (e.g., "10th gen")
  let match = lower.match(/(\d+)(?:st|nd|rd|th)\s*gen(?:eration)?/);
  if (match) {
    return match[1] + 'th gen';
  }
  
  // Extract Intel generation from model number (e.g., i5-10400)
  match = lower.match(/i[3579][\s-]*(\d)(\d{3})/);
  if (match) {
    return match[1] + 'th gen';
  }
  
  // Check for AMD Ryzen series
  match = lower.match(/ryzen\s*(\d+)/);
  if (match) {
    return 'ryzen ' + match[1];
  }
  
  return '';
}

function extractRam(name) {         
    const lower = norm(name);   
    const match = lower.match(/(\d{4}mb|\d{2}gb)/);
    if (match) {    
        return match[0];
        }               
    return '';
}
function extractStorage(name) {
    const lower = norm(name);   
    const match = lower.match(/(\d{3,4}gb|\d{2}tb)/);
    if (match) {    
        return match[0];
    }               
    return '';
}
function extractGpu(name) {
    const lower = norm(name);
    const match = lower.match(/(gtx|rtx|radeon|intel)/);
    if (match) {    
        return match[0];
    }   
    return '';
}
// --- Normalizers ---
function normalizeFlipkart(f) {
  const t = f.technicalDetails || {};
  const hasSSD = (t.SSD || '').toLowerCase() === 'yes';
  const storageSize = hasSSD
    ? stripUnits(t['SSD Capacity'])
    : stripUnits(t['EMMC Storage Capacity']);
  const storageType = hasSSD ? 'ssd' : norm(t['Storage Type']);
  const dispMatch = (t['Screen Size'] || '').match(/\(([\d.]+)\s*inch\)/i);

  return {
    // brand:       norm((t['Model Name'] || f.productName).split(' ')[0]),
    brand: extractModel(f.productName),
    series:      extractSeries(f.productName),
    processor: {
      brand:   norm(t['Processor Brand']),
    //   name:    norm(t['Processor Name']),
    name: extractProcessor(f.productName),
    gen: extractProcessorGeneration(f.productName),
      variant: norm(t['Processor Variant'])
    },
    ram: {
      size: stripUnits(t['RAM']),
      type: norm(t['RAM Type'])
    },
    storage: {
      size: storageSize,
      type: storageType
    },
    displayInch: dispMatch ? parseFloat(dispMatch[1]) : null,
    // gpu:         norm(t['Graphic Processor']),
    gpu: extractGpu(f.productName),
    price:       Number((f.price || '').replace(/[^0-9]/g,'')),  // still stored but not matched on
    link:        f.cleanProductLink,
    rating:      Number(f.rating || 0)
  };
}

function normalizeAmazon(a) {
  const d = a.details || {};
  const storageSize = stripUnits(d['Hard Drive Size']);
  const storageType = norm(d['Hard Disk Description']);
  const disp         = stripUnits(d['Standing screen display size']);
  const title        = a.title || '';
  const variantMatch = title.match(/i\d-\d{3,4}([uhpg])\d*/i)
                       || title.match(/-(\d{3,4}[uhpg])/i);

  return {
    // brand:  norm(d['Brand'] || title.split(' ')[0]),
    brand:  extractModel(title),
    series: extractSeries(title),
    processor: {
      brand:   norm(d['Processor Brand']),
    //   name:    norm(d['Processor Type']),
    name: extractProcessor(title),
    gen: extractProcessorGeneration(title),
      variant: variantMatch ? variantMatch[1].toLowerCase() : ''
    },
    ram: {
      size: stripUnits(d['RAM Size'] || d['Memory Technology']),
      type: norm(d['Memory Technology'])
    },
    storage: {
      size: storageSize,
      type: storageType
    },
    displayInch: parseFloat(disp) || null,
    // gpu:         norm(d['Graphics Coprocessor'] || d['Graphics Card Description']),
    gpu: extractGpu(title),
    price:       Number((a.price || '').replace(/[^0-9]/g,'')),  // still stored but not matched on
    link:        a.url,
    rating:      Number(a.rating || 0)
  };
}

function makeKey(lap) {
  return [
    lap.brand,
    lap.series,
    lap.processor.brand,
    lap.processor.name,
    lap.processor.gen,
    lap.processor.variant,
    lap.ram.size,
    lap.ram.type,
    lap.storage.size,
    lap.storage.type,
    lap.displayInch,
    lap.gpu
  ].join('|');
}

// --- Matching & Stats ---
function buildFinalEntries(amazonData, flipkartData) {
  const fkMap = new Map();
  flipkartData.forEach(f => {
    const normF = normalizeFlipkart(f);
    fkMap.set(makeKey(normF), { ...normF, _matched: false });
  });

  const finalEntries    = [];
  let matchCount        = 0;
  let amazonOnlyCount   = 0;
  let flipkartOnlyCount = 0;

  // Match Amazon vs Flipkart
  amazonData.forEach(a => {
    const normA = normalizeAmazon(a);
    const key   = makeKey(normA);

    if (fkMap.has(key)) {
      const fkRec = fkMap.get(key);
      fkRec._matched = true;
      matchCount++;
        // Get the name full name from Amazon
      const fkName = fkRec.brand + ' ' + fkRec.series;
      console.log(`Matched: ${normA.brand} ${normA.series} <-> ${fkName}`);
      finalEntries.push({
        brand: normA.brand,
        series: normA.series,
        specs: {
          processor:   normA.processor,
          ram:         normA.ram,
          storage:     normA.storage,
          displayInch: normA.displayInch,
          gpu:         normA.gpu
        },
        sites: [
          { source: 'amazon',   price: normA.price,   link: normA.link,   rating: normA.rating },
          { source: 'flipkart', price: fkRec.price,   link: fkRec.link,   rating: fkRec.rating }
        ]
      });
    } else {
      amazonOnlyCount++;
      finalEntries.push({
        brand: normA.brand,
        series: normA.series,
        specs: {
          processor:   normA.processor,
          ram:         normA.ram,
          storage:     normA.storage,
          displayInch: normA.displayInch,
          gpu:         normA.gpu
        },
        sites: [
          { source: 'amazon', price: normA.price, link: normA.link, rating: normA.rating }
        ]
      });
    }
  });

  // Any Flipkart-only
  fkMap.forEach(fkRec => {
    if (!fkRec._matched) {
      flipkartOnlyCount++;
      finalEntries.push({
        brand: fkRec.brand,
        series: fkRec.series,
        specs: {
          processor:   fkRec.processor,
          ram:         fkRec.ram,
          storage:     fkRec.storage,
          displayInch: fkRec.displayInch,
          gpu:         fkRec.gpu
        },
        sites: [
          { source: 'flipkart', price: fkRec.price, link: fkRec.link, rating: fkRec.rating }
        ]
      });
    }
  });

  // --- Stats Logging ---
  console.log(`✅ Matched laptops: ${matchCount}`);
  console.log(`❌ Unmatched Amazon entries: ${amazonOnlyCount}`);
  console.log(`❌ Unmatched Flipkart entries: ${flipkartOnlyCount}`);
  console.log(`📦 Total final laptop records: ${finalEntries.length}`);

  return finalEntries;
}

// --- Main Execution ---
(function main() {
  const amazonPath   = path.join(__dirname, 'amazon_complete_final.json');
  const flipkartPath = path.join(__dirname, './Flipkart/RemoveHp.json');

  const amazonData   = JSON.parse(fs.readFileSync(amazonPath, 'utf-8'));
  const flipkartData = JSON.parse(fs.readFileSync(flipkartPath, 'utf-8'));

  const finalLaptops = buildFinalEntries(amazonData, flipkartData);

  // Write out the combined JSON
  fs.writeFileSync(
    path.join(__dirname, 'final_laptops.json'),
    JSON.stringify(finalLaptops, null, 2),
    'utf-8'
  );
})();
