import XLSX from 'xlsx';
import fs from 'fs';

try {
    const file = fs.readFileSync('telemarkting0106-13(1).xlsx');
    const wb = XLSX.read(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);
    if (json.length > 0) {
        console.log('Headers:', Object.keys(json[0]));
        console.log('Sample Row:', json[0]);
    } else {
        console.log('Sheet is empty');
    }
} catch (e) {
    console.error(e);
}
