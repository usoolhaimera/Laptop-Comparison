const fs= require('fs');
const path = require('path');

const data = require('./amazon_complete_data.json');

function removeRefurbished(data) {
    const filtered = data.filter(item => {
        const title = item.title.toLowerCase();
        return !title.includes('refurbished') && !title.includes('renewed');
    });
    return filtered;
}
const removedRefurbished = removeRefurbished(data);
const outputPath = path.join(__dirname, 'amazon_complete_final.json');
fs.writeFileSync(outputPath, JSON.stringify(removedRefurbished, null, 2));