import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from 'xlsx';

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ImportLeadsModal({ open, onOpenChange, onImportComplete }: ImportLeadsModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ name: string; phone: string }[]>([]);

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
        
        const previewData = jsonData.slice(0, 5).map((row: any) => {
          const phone = String(row.phone || row.Phone || row.number || row.Number || row.phoneNumber || '').trim();
          const name = String(row.name || row.Name || row.customer || row.Customer || phone).trim();
          return {
            name: name || 'Unknown',
            phone: phone
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
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            const leads = jsonData.map((row: any) => {
              const phone = String(row.phone || row.Phone || row.number || row.Number || row.phoneNumber || row.username || '').trim();
              const name = String(row.name || row.Name || row.customer || row.Customer || phone).trim();
              const segment = detectSegment(row);
              const priority = segment === 'vip' ? 'high' : segment === 'dormant' ? 'low' : 'medium';
              
              return {
                user_id: null, // Will be auto-distributed
                name: name || 'Unknown',
                phone: phone,
                segment: segment,
                priority: priority,
                score: segment === 'vip' ? 80 : segment === 'semi-active' ? 50 : 20,
                tags: [],
                last_deposit_ugx: parseFloat(String(row.last_deposit || row.deposit || row['近一年充值金额(美元)'] || 0).replace(/[^0-9.]/g, '')) || 0
              };
            }).filter(lead => lead.phone);

            const { error } = await supabase
              .from('leads')
              .insert(leads);

            if (error) throw error;

            // Auto-distribute leads among agents
            const { data: distributionData } = await supabase.functions.invoke('distribute-leads');
            
            if (distributionData?.distributed > 0) {
              toast.success(`Successfully imported ${leads.length} leads and distributed to ${distributionData.distribution?.length || 0} agents`);
            } else {
              toast.success(`Successfully imported ${leads.length} leads`);
            }
            
            onImportComplete();
            onOpenChange(false);
            setFile(null);
            setPreview([]);
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
          const text = e.target?.result as string;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
          
          const nameIndex = headers.findIndex(h => h.includes('name'));
          const phoneIndex = headers.findIndex(h => h.includes('phone') || h.includes('number'));

          const actualPhoneIndex = phoneIndex !== -1 ? phoneIndex : 0;

          const leads = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const phone = values[actualPhoneIndex] || '';
            const name = nameIndex !== -1 ? values[nameIndex] : phone;
            
            return {
              user_id: null, // Admin imports as unassigned
              name: name || 'Unknown',
              phone: phone,
              segment: 'dormant',
              priority: 'low',
              score: 20,
              tags: []
            };
          }).filter(lead => lead.phone);

          const { error } = await supabase
            .from('leads')
            .insert(leads);

          if (error) throw error;

          toast.success(`Successfully imported ${leads.length} leads`);
          onImportComplete();
          onOpenChange(false);
          setFile(null);
          setPreview([]);
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
            <Label htmlFor="csv-file">CSV File</Label>
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
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2">Name</th>
                      <th className="text-left p-2">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 font-mono">{row.phone}</td>
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
              <strong>File Format:</strong> CSV or Excel with phone numbers required. Optional columns: name, last_deposit, last_activity.
              <br />System will auto-assign segments: VIP (&gt;100k deposits), Dormant (30+ days inactive), Semi-Active (others).
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
              {importing ? "Importing..." : "Import Leads"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
