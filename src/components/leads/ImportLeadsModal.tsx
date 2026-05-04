import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';
import { detectCountryFromPhone, formatPhoneForCountry } from "@/config/countries";

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportLeadsModal({ open, onOpenChange, onImportComplete }: ImportLeadsModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ name: string; phone: string; trait?: string; deposit?: string }[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<'betting_platform' | 'generic' | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const isCSV = selectedFile.name.endsWith('.csv');
      const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
      
      if (!isCSV && !isExcel) {
        toast.error('Please select a CSV or Excel file');
        return;
      }
      setFile(selectedFile);
      
      if (isExcel) {
        parseExcelPreview(selectedFile);
      } else {
        parseCSVPreview(selectedFile);
      }
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const country = detectCountryFromPhone(phone);
    return formatPhoneForCountry(phone, country);
  };

  // Column name mappings for the betting platform export (Chinese headers)
  const BETTING_PLATFORM_COLUMNS: Record<string, string> = {
    'username': 'phone',
    '手机号': 'phone',
    '最后登录时间': 'last_login',
    '分类': 'category',                   // 体育=sports, 游戏=gaming
    '总票数': 'total_bets',
    '体育票数': 'sports_bets',
    '游戏票数': 'game_bets',
    '充值金额(美金)': 'deposit_usd',
    '近一年充值金额(美元)': 'deposit_usd',
    '充值金额(本币)': 'deposit_local',
    '召回日期内充值金额': 'deposit_local',
    // Benefit columns — split by category and type
    '账面体育coupon成本': 'sports_coupon_cost',
    '体育coupon': 'sports_coupon',
    '账面游戏coupon成本': 'game_coupon_cost',
    '游戏coupon': 'game_coupon',
    '体育奖金': 'sports_bonus',
    '游戏奖金': 'game_bonus',
    '免费投注': 'freebet',
    '免费旋转': 'freespin',
    // Legacy single-coupon columns (kept for backwards compatibility with old files)
    '账面coupon成本': 'coupon_cost_legacy',
    'coupon': 'coupon_legacy',
    // Deposit / activity
    '是否充值': 'has_deposited',
    '充值金额': 'deposit_amount',
    '投注总金额': 'total_bet_amount',
    '总ggr': 'total_ggr',
    '召回日内总盈利': 'total_ggr',
    '召回日期内总投注金额': 'total_bets',
    '体育投注金额': 'sports_bet_amount',
    '游戏投注金额': 'game_bet_amount',
    '体育ggr': 'sports_ggr',
    '游戏ggr': 'game_ggr',
  };

  const isBettingPlatformFile = (headers: string[]): boolean => {
    return headers.some(h => Object.keys(BETTING_PLATFORM_COLUMNS).includes(h));
  };

  const normalizeRow = (row: any): Record<string, any> => {
    const normalized: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = String(key).trim();
      const mapped = BETTING_PLATFORM_COLUMNS[cleanKey];
      if (mapped) {
        normalized[mapped] = value;
      } else {
        normalized[cleanKey.toLowerCase()] = value;
        normalized[cleanKey] = value;
      }
    }
    return normalized;
  };

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  };

  const excelDateToJS = (serial: any): Date | null => {
    if (!serial) return null;
    if (typeof serial === 'string') {
      const d = new Date(serial);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof serial === 'number') {
      // Excel serial date to JS Date
      const utcDays = Math.floor(serial - 25569);
      return new Date(utcDays * 86400 * 1000);
    }
    return null;
  };

  const classifyLead = (data: Record<string, any>): {
    segment: string; priority: string; score: number; trait: string | null;
  } => {
    const depositUSD = parseNumber(data.deposit_usd);
    const depositLocal = parseNumber(data.deposit_local);
    const totalBets = parseNumber(data.total_bets);
    const totalGGR = parseNumber(data.total_ggr);

    // Classify by deposit amount in USD
    // High staker: >$1000 USD or >3.5M local currency
    // Medium staker: >$200 USD or >700K local
    // Low staker: everything else
    if (depositUSD >= 1000 || depositLocal >= 3500000) {
      return {
        segment: 'vip',
        priority: 'high',
        score: Math.min(95, 70 + Math.floor(depositUSD / 500)),
        trait: 'High Staker',
      };
    }

    if (depositUSD >= 200 || depositLocal >= 700000) {
      return {
        segment: 'semi-active',
        priority: 'medium',
        score: Math.min(70, 40 + Math.floor(depositUSD / 100)),
        trait: 'Medium Staker',
      };
    }

    // Check for active bettors with low deposits
    if (totalBets >= 500) {
      return {
        segment: 'semi-active',
        priority: 'medium',
        score: 45,
        trait: 'Frequent Bettor',
      };
    }

    // Check last login for dormancy
    const lastLogin = excelDateToJS(data.last_login);
    if (lastLogin) {
      const daysSinceLogin = Math.floor((Date.now() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLogin > 60) {
        return { segment: 'dormant', priority: 'low', score: 15, trait: 'Dormant' };
      }
    }

    return {
      segment: depositUSD > 50 ? 'semi-active' : 'dormant',
      priority: depositUSD > 50 ? 'medium' : 'low',
      score: depositUSD > 50 ? 35 : 20,
      trait: depositUSD > 0 ? 'Low Staker' : null,
    };
  };

  const detectSegment = (data: any): string => {
    // Auto-detect segment based on data patterns
    const lastDepositStr = String(data.last_deposit || data.lastDeposit || data.deposit || '0').toLowerCase();
    const lastDeposit = parseFloat(lastDepositStr.replace(/[^0-9.]/g, '')) || 0;

    const lastActivityStr = String(data.last_activity || data.lastActivity || data.activity || '').toLowerCase();
    const daysInactive = lastActivityStr.includes('day')
      ? parseInt(lastActivityStr.match(/\d+/)?.[0] || '0')
      : 0;

    // VIP: High deposits (>100,000 UGX) or marked as VIP
    if (lastDeposit > 100000 || lastActivityStr.includes('vip')) {
      return 'vip';
    }

    // Dormant: Inactive for 30+ days or marked dormant
    if (daysInactive > 30 || lastActivityStr.includes('dormant') || lastActivityStr.includes('inactive')) {
      return 'dormant';
    }

    // Default to semi-active
    return 'semi-active';
  };

  const parseExcelPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        const headers = Object.keys(jsonData[0] || {});

        if (isBettingPlatformFile(headers)) {
          setDetectedFormat('betting_platform');
          const previewData = jsonData.slice(0, 5).map((row: any) => {
            const normalized = normalizeRow(row);
            const phone = String(normalized.phone || '').trim();
            const classification = classifyLead(normalized);
            const depositUSD = parseNumber(normalized.deposit_usd);
            return {
              name: `User ${phone.slice(-4)}`,
              phone,
              trait: classification.trait || undefined,
              deposit: depositUSD > 0 ? `$${depositUSD.toLocaleString()}` : '—',
            };
          });
          setPreview(previewData);
        } else {
          setDetectedFormat('generic');
          const previewData = jsonData.slice(0, 5).map((row: any) => {
            const phone = String(row.phone || row.Phone || row.number || row.Number || row.phoneNumber || row.phonenumber || row['phone number'] || row.mobile || row.username || row['手机号'] || row.contact || '').trim();
            const name = String(row.name || row.Name || row.customer || row.Customer || phone).trim();
            return { name: name || 'Unknown', phone };
          });
          setPreview(previewData);
        }
      } catch (error) {
        console.error('Error parsing Excel:', error);
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const parseCSVPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('number'));

      // If no phone column found, assume first column is phone numbers
      const actualPhoneIndex = phoneIndex !== -1 ? phoneIndex : 0;

      const previewData = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        const phone = values[actualPhoneIndex] || '';
        const name = nameIndex !== -1 ? values[nameIndex] : phone;
        return {
          name: name || 'Unknown',
          phone: phone
        };
      });

      setPreview(previewData);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    if (!user?.id) {
      toast.error('You must be logged in to import leads');
      return;
    }

    setImporting(true);
    setProgress({ current: 0, total: 0 });
    
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      
      if (isExcel) {
        // Handle Excel import
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            // Detect if headerless
            const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
            const firstRow = rawRows[0] || [];
            const hasPhone = firstRow.some(v => {
              const s = String(v || "").replace(/\D/g, "");
              return s.length >= 9 && s.length <= 15;
            });
            const hasTextHeaders = firstRow.some(v => typeof v === "string" && v.length > 3 && !/^\d+$/.test(String(v).replace(/\+/g, '')));
            
            let jsonData: any[] = [];
            if (!hasTextHeaders && hasPhone) {
              jsonData = rawRows.map(r => {
                const obj: any = {};
                r.forEach((v, i) => { obj[`col_${i}`] = v; });
                return obj;
              });
            } else {
              jsonData = XLSX.utils.sheet_to_json(firstSheet);
            }

            const headers = Object.keys(jsonData[0] || {});
            const isBettingFile = isBettingPlatformFile(headers);

            const leads = jsonData.map((row: any) => {
              if (isBettingFile) {
                // Rich betting platform import
                const normalized = normalizeRow(row);
                const rawPhone = String(normalized.phone || '').trim();
                const phone = formatPhoneNumber(rawPhone);
                const classification = classifyLead(normalized);
                const depositUSD = parseNumber(normalized.deposit_usd);
                const depositLocal = parseNumber(normalized.deposit_local);
                const totalBets = parseNumber(normalized.total_bets);
                const sportsBets = parseNumber(normalized.sports_bets);
                const gameBets = parseNumber(normalized.game_bets);
                const totalGGR = parseNumber(normalized.total_ggr);
                const sportsGGR = parseNumber(normalized.sports_ggr);
                const gameGGR = parseNumber(normalized.game_ggr);
                const totalBetAmount = parseNumber(normalized.total_bet_amount);
                const sportsBetAmount = parseNumber(normalized.sports_bet_amount);
                const gameBetAmount = parseNumber(normalized.game_bet_amount);
                const lastLogin = excelDateToJS(normalized.last_login);
                const category = String(normalized.category || '');

                // Map Chinese category to English product preference
                const productMap: Record<string, string> = {
                  '体育': 'Sports',
                  '游戏': 'Gaming',
                  '彩票': 'Lottery',
                };
                const preferredProduct = productMap[category] || (sportsBets > gameBets ? 'Sports' : gameBets > 0 ? 'Gaming' : null);

                // Benefits — prefer split columns, fall back to legacy single-coupon columns
                const sportsCouponCost = parseNumber(normalized.sports_coupon_cost);
                const gameCouponCost = parseNumber(normalized.game_coupon_cost);
                const legacyCouponCost = parseNumber(normalized.coupon_cost_legacy);
                const sportsBonus = parseNumber(normalized.sports_bonus);
                const gameBonus = parseNumber(normalized.game_bonus);
                const freebet = normalized.freebet ?? null;
                const freespin = normalized.freespin ?? null;

                return {
                  user_id: null,
                  name: `User ${rawPhone.slice(-4)}`,
                  phone,
                  segment: classification.segment,
                  priority: classification.priority,
                  score: classification.score,
                  lead_score: classification.score,
                  trait: classification.trait,
                  preferred_product: preferredProduct,
                  last_deposit_ugx: depositLocal || Math.round(depositUSD * 3700),
                  lifetime_value: depositLocal || Math.round(depositUSD * 3700),
                  deposit_count: totalBets,
                  last_bet_date: lastLogin ? lastLogin.toISOString().split('T')[0] : null,
                  betting_patterns: {
                    deposit_usd: depositUSD,
                    deposit_local: depositLocal,
                    total_bets: totalBets,
                    sports_bets: sportsBets,
                    game_bets: gameBets,
                    total_ggr: totalGGR,
                    sports_ggr: sportsGGR,
                    game_ggr: gameGGR,
                    total_bet_amount: totalBetAmount,
                    sports_bet_amount: sportsBetAmount,
                    game_bet_amount: gameBetAmount,
                    last_login: lastLogin?.toISOString() || null,
                    platform_category: category,
                    // Benefit fields
                    sports_coupon_cost: sportsCouponCost || legacyCouponCost,
                    sports_coupon: normalized.sports_coupon ?? normalized.coupon_legacy ?? null,
                    game_coupon_cost: gameCouponCost,
                    game_coupon: normalized.game_coupon ?? null,
                    sports_bonus: sportsBonus,
                    game_bonus: gameBonus,
                    freebet,
                    freespin,
                  },
                  tags: [],
                };
              } else {
                // Generic import (legacy)
                let rawPhone = String(row.phone || row.Phone || row.number || row.Number || row.phoneNumber || row.phonenumber || row['phone number'] || row.mobile || row.username || row['手机号'] || row.contact || '').trim();
                
                if (!rawPhone) {
                  for (const val of Object.values(row)) {
                    const s = String(val || "").replace(/\D/g, "");
                    if (s.length >= 9 && s.length <= 15) {
                      rawPhone = s;
                      break;
                    }
                  }
                }
                
                const phone = formatPhoneNumber(rawPhone);
                const name = String(row.name || row.Name || row.customer || row.Customer || '').trim();
                const segment = detectSegment(row);
                const priority = segment === 'vip' ? 'high' : segment === 'dormant' ? 'low' : 'medium';

                return {
                  user_id: null,
                  name: name || 'Customer',
                  phone,
                  segment,
                  priority,
                  score: segment === 'vip' ? 80 : segment === 'semi-active' ? 50 : 20,
                  tags: [],
                  last_deposit_ugx: parseFloat(String(row.last_deposit || row.deposit || row['近一年充值金额(美元)'] || 0).replace(/[^0-9.]/g, '')) || 0,
                };
              }
            }).filter((lead: any) => lead.phone && lead.phone.length >= 12);

            // Batch insert in chunks of 100
            const BATCH_SIZE = 100;
            const totalBatches = Math.ceil(leads.length / BATCH_SIZE);
            setProgress({ current: 0, total: totalBatches });

            for (let i = 0; i < leads.length; i += BATCH_SIZE) {
              const batch = leads.slice(i, i + BATCH_SIZE);
              await api.post('/leads/import-csv', { leads: batch });
              setProgress({ current: Math.floor(i / BATCH_SIZE) + 1, total: totalBatches });
            }

            const traitSummary = isBettingFile
              ? (() => {
                  const traits: Record<string, number> = {};
                  leads.forEach((l: any) => { if (l.trait) traits[l.trait] = (traits[l.trait] || 0) + 1; });
                  return Object.entries(traits).map(([t, c]) => `${c} ${t}`).join(', ');
                })()
              : '';

            toast.success(
              `Imported ${leads.length} leads` + (traitSummary ? ` (${traitSummary})` : '')
            );
            onImportComplete();
            onOpenChange(false);
            setFile(null);
            setPreview([]);
            setDetectedFormat(null);
            setProgress({ current: 0, total: 0 });
          } catch (error) {
            console.error('Error importing Excel:', error);
            toast.error('Failed to import Excel file');
          } finally {
            setImporting(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Handle CSV import
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string;
            const lines = text.split('\n').filter(line => line.trim());
            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
            
            const nameIndex = headers.findIndex(h => h.includes('name'));
            const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('number'));

            const actualPhoneIndex = phoneIndex !== -1 ? phoneIndex : 0;

          const leads = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const rawPhone = values[actualPhoneIndex] || '';
            const phone = formatPhoneNumber(rawPhone);
            const name = nameIndex !== -1 ? values[nameIndex] : '';

            return {
              user_id: null,
              name: name || 'Customer',
              phone: phone,
              segment: 'semi-active',
              priority: 'medium',
              score: 20,
              lead_score: 20,
              tags: []
            };
          }).filter(lead => lead.phone && lead.phone.length >= 12);

            // Batch insert in chunks of 100
            const BATCH_SIZE = 100;
            const totalBatches = Math.ceil(leads.length / BATCH_SIZE);
            setProgress({ current: 0, total: totalBatches });

            for (let i = 0; i < leads.length; i += BATCH_SIZE) {
              const batch = leads.slice(i, i + BATCH_SIZE);
              await api.post('/leads/import-csv', { leads: batch });
              setProgress({ current: Math.floor(i / BATCH_SIZE) + 1, total: totalBatches });
            }

            toast.success(`Successfully imported ${leads.length} leads`);
            onImportComplete();
            onOpenChange(false);
            setFile(null);
            setPreview([]);
            setDetectedFormat(null);
            setProgress({ current: 0, total: 0 });
          } catch (error) {
            console.error('Error importing CSV:', error);
            toast.error('Failed to import CSV file');
          } finally {
            setImporting(false);
          }
        };
        reader.readAsText(file);
      }
    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV/Excel</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file with phone numbers. System will auto-detect segments (VIP, Semi-Active, Dormant) based on deposit and activity data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload File (CSV or Excel)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={importing}
              />
              <Button variant="outline" size="icon" disabled>
                <Upload className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {file && (
            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
              </AlertDescription>
            </Alert>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Preview (first 5 rows)
                {detectedFormat === 'betting_platform' && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                    Betting Platform Data Detected
                  </span>
                )}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Phone</th>
                      {detectedFormat === 'betting_platform' && (
                        <>
                          <th className="text-left p-2">Deposit</th>
                          <th className="text-left p-2">Classification</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 font-mono">{row.phone}</td>
                        {detectedFormat === 'betting_platform' && (
                          <>
                            <td className="p-2 font-mono">{row.deposit}</td>
                            <td className="p-2">
                              {row.trait && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                                  row.trait === 'High Staker' ? 'bg-red-100 text-red-700' :
                                  row.trait === 'Medium Staker' ? 'bg-amber-100 text-amber-700' :
                                  row.trait === 'Frequent Bettor' ? 'bg-blue-100 text-blue-700' :
                                  row.trait === 'Dormant' ? 'bg-gray-100 text-gray-600' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {row.trait}
                                </span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {detectedFormat === 'betting_platform' ? (
                <>
                  <strong>Betting Platform Export Detected!</strong> System will auto-extract deposit amounts, bet counts, preferred products (Sports/Gaming), and classify leads as:
                  <br /><strong>High Staker</strong> (&gt;$1,000), <strong>Medium Staker</strong> (&gt;$200), <strong>Frequent Bettor</strong> (500+ bets), <strong>Low Staker/Dormant</strong>.
                </>
              ) : (
                <>
                  <strong>File Format:</strong> CSV or Excel with phone numbers required. Optional columns: name, last_deposit, last_activity.
                  <br />Supports betting platform exports with Chinese headers (username, 充值金额, 分类, etc.)
                  <br />System will auto-assign segments: VIP (&gt;100k deposits), Dormant (30+ days inactive), Semi-Active (others).
                </>
              )}
            </AlertDescription>
          </Alert>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={importing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing 
                ? progress.total > 0 
                  ? `Importing... ${progress.current}/${progress.total}` 
                  : "Importing..." 
                : "Import Leads"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
