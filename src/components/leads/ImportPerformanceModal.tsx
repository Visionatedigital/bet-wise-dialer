import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';

interface ImportPerformanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportPerformanceModal({ open, onOpenChange, onImportComplete }: ImportPerformanceModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ phone: string; deposit: string; bets: string }[]>([]);
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

  const parseExcelPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const previewData = jsonData.slice(0, 5).map((row: any) => {
          return {
            phone: String(row.phone || row.Phone || row.username || row.Number || '').trim(),
            deposit: String(row.deposit || row.amount || row.deposit_amount || '0'),
            bets: String(row.bets || row.bet_count || row.activity || '0'),
          };
        });
        setPreview(previewData);
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
      
      const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('number') || h.includes('user'));
      const depositIdx = headers.findIndex(h => h.includes('deposit') || h.includes('amount'));
      const betsIdx = headers.findIndex(h => h.includes('bet') || h.includes('count') || h.includes('activity'));

      const previewData = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          phone: phoneIdx !== -1 ? values[phoneIdx] : values[0],
          deposit: depositIdx !== -1 ? values[depositIdx] : '0',
          bets: betsIdx !== -1 ? values[betsIdx] : '0',
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

    setImporting(true);
    setProgress({ current: 0, total: 0 });
    
    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
      let dataToUpdate: any[] = [];

      if (isExcel) {
        const reader = new FileReader();
        const promise = new Promise<void>((resolve, reject) => {
          reader.onload = async (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
              const jsonData = XLSX.utils.sheet_to_json(firstSheet);

              dataToUpdate = jsonData.map((row: any) => ({
                phone: String(row.phone || row.Phone || row.username || row.Number || '').trim(),
                deposit_amount: parseFloat(String(row.deposit || row.amount || row.deposit_amount || '0').replace(/[^0-9.]/g, '')) || 0,
                bet_count: parseInt(String(row.bets || row.bet_count || row.activity || '0').replace(/[^0-9]/g, '')) || 0,
                last_activity: row.last_activity || row.activity_date || null
              })).filter(d => d.phone);
              resolve();
            } catch (err) { reject(err); }
          };
          reader.readAsArrayBuffer(file);
        });
        await promise;
      } else {
        const reader = new FileReader();
        const promise = new Promise<void>((resolve, reject) => {
          reader.onload = async (e) => {
            try {
              const text = e.target?.result as string;
              const lines = text.split('\n').filter(line => line.trim());
              const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
              
              const phoneIdx = headers.findIndex(h => h.includes('phone') || h.includes('number') || h.includes('user'));
              const depositIdx = headers.findIndex(h => h.includes('deposit') || h.includes('amount'));
              const betsIdx = headers.findIndex(h => h.includes('bet') || h.includes('count') || h.includes('activity'));

              dataToUpdate = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                return {
                  phone: phoneIdx !== -1 ? values[phoneIdx] : values[0],
                  deposit_amount: parseFloat((depositIdx !== -1 ? values[depositIdx] : '0').replace(/[^0-9.]/g, '')) || 0,
                  bet_count: parseInt((betsIdx !== -1 ? values[betsIdx] : '0').replace(/[^0-9]/g, '')) || 0,
                  last_activity: null
                };
              }).filter(d => d.phone);
              resolve();
            } catch (err) { reject(err); }
          };
          reader.readAsText(file);
        });
        await promise;
      }

      // Batch update in chunks of 50
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(dataToUpdate.length / BATCH_SIZE);
      setProgress({ current: 0, total: totalBatches });

      for (let i = 0; i < dataToUpdate.length; i += BATCH_SIZE) {
        const batch = dataToUpdate.slice(i, i + BATCH_SIZE);
        await api.post('/leads/import-performance', { data: batch });
        setProgress({ current: Math.floor(i / BATCH_SIZE) + 1, total: totalBatches });
      }

      toast.success(`Updated performance for ${dataToUpdate.length} leads`);
      onImportComplete();
      onOpenChange(false);
      setFile(null);
      setPreview([]);
    } catch (error) {
      console.error('Error importing performance:', error);
      toast.error('Failed to import performance data');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Import Post-Call Performance
          </DialogTitle>
          <DialogDescription>
            Upload data from the betting platform to track which called leads have deposited or played within the recent weeks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="perf-file">Upload File (CSV or Excel)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="perf-file"
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={importing}
                className="cursor-pointer"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Required columns: <strong>phone</strong>. Recommended: <strong>deposit</strong>, <strong>bets</strong>.
            </p>
          </div>

          {preview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Data Preview
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Phone</th>
                      <th className="text-left p-2">Deposit</th>
                      <th className="text-left p-2">Bets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2 font-mono">{row.phone}</td>
                        <td className="p-2 text-green-600 font-medium">{row.deposit}</td>
                        <td className="p-2 text-blue-600">{row.bets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-800">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              System will match numbers and <strong>increment</strong> their total post-call deposits and bet counts.
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
              className="bg-primary hover:bg-primary/90"
            >
              {importing 
                ? `Importing ${progress.current}/${progress.total}...` 
                : "Update Performance Data"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
