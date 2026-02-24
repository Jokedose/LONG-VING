const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('/Users/trirong/self/running/LONG-VING/public/source/zone2_full.xlsx');
const sheet = workbook.Sheets['📋 Weekly Plan'];
const data = XLSX.utils.sheet_to_json(sheet, {header: 1});

const result = [];
for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row && typeof row[0] === 'string' && row[0].startsWith('Wk ')) {
        const weekNum = parseInt(row[0].replace('Wk ', ''));
        const targetKmStr = String(row[11] || '0');
        const targetKm = parseInt(targetKmStr.split('-').pop()) || 0; 
        const notes = row[12] ? ` [Note: ${row[12]}]` : '';
        
        const monthIndex = Math.floor((weekNum - 1) / 4); 

        result.push({
            weekNumber: weekNum,
            monthIndex: monthIndex,
            targetKm: targetKm,
            phase: row[3] || 'Base',
            description: [row[4], row[5], row[6], row[7]].filter(s => s).map(s => s.replace(/\n/g, ' ')).join(' | ') + notes
        });
    }
}

console.log(JSON.stringify(result, null, 2));
