import XLSX from 'xlsx';
import fs from 'fs';

const PLATFORM_COLUMNS = {
  'username': 'phone',
  '最后登录时间': 'last_login',
  '分类': 'category',
  '总票数': 'total_bets',
  '体育票数': 'sports_bets',
  '游戏票数': 'game_bets',
  '充值金额(美金)': 'deposit_usd',
  '充值金额(本币)': 'deposit_local',
  '投注总金额': 'total_bet_amount',
  '总ggr': 'total_ggr',
};

function formatPhoneForCountry(raw, countryCode) {
  let digits = String(raw).replace(/\D/g, '');
  const dialCode = "256"; // UG
  if (digits.startsWith('0')) digits = dialCode + digits.slice(1);
  if (!digits.startsWith(dialCode)) digits = dialCode + digits;
  return '+' + digits;
}

try {
    const file = fs.readFileSync('telemarkting0106-13(1).xlsx');
    const wb = XLSX.read(file);
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    console.log('JSON Length:', json.length);

    const built = json.map((row) => {
        const mapped = {};
        for (const [k, v] of Object.entries(row)) {
          const cleanK = String(k).trim();
          const out = PLATFORM_COLUMNS[cleanK] || cleanK.toLowerCase();
          mapped[out] = v;
        }
        const rawPhone = String(mapped.phone || mapped.number || mapped.phonenumber || mapped['phone number'] || mapped.mobile || mapped.msisdn || mapped.username || mapped['手机号'] || mapped.contact || "").trim();
        if (!rawPhone) return null;
        const phone = formatPhoneForCountry(rawPhone, "UG");
        if (phone.replace(/\D/g, "").length < 10) return null;
        return { phone };
    }).filter(x => x !== null);

    console.log('Built Length:', built.length);
    if (built.length > 0) console.log('First Built:', built[0]);
} catch (e) {
    console.error(e);
}
