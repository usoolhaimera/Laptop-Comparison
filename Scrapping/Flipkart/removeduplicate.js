const fs = require('fs');
const path = require('path');

const Apple = require('./Apple.json');
const Dell = require('./Dell.json');
const HP = require('./hp.json');
const MSI = require('./msi.json');
const asar = require('./asar.json');

const allLaptops = [...Apple, ...Dell, ...HP, ...MSI, ...asar];



function removeDuplicates(data) {
    const filtered = data.filter((_, index) => index % 2 === 0);
    return filtered 
}

const removedLaptops = removeDuplicates(HP);


const outputPath = path.join(__dirname, 'RemoveHp.json');
fs.writeFileSync(outputPath, JSON.stringify(removedLaptops, null, 2));

console.log(`Successfully removed duplicates! Found ${HP.length - removedLaptops.length} duplicates.`);
console.log(`Original count: ${HP.length}, New count: ${removedLaptops.length}`);
console.log(`Output saved to ${outputPath}`);