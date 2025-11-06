import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle } from "lucide-react";
import * as XLSX from 'xlsx';

interface ImportLeadsForAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  agentId: string;
  agentName: string;
}

export function ImportLeadsForAgentModal({ 
  open, 
  onOpenChange, 
  onImportComplete, 
  agentId,
  agentName 
}: ImportLeadsForAgentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      toast.error('Please upload a CSV or Excel file');
      return;
    }

    setFile(selectedFile);
    parsePreview(selectedFile);
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 0, replace with 256
    if (cleaned.startsWith('0')) {
      cleaned = '256' + cleaned.slice(1);
    }
    
    // If it doesn't start with +, add it
    if (!cleaned.startsWith('256')) {
      cleaned = '256' + cleaned;
    }
    
    return '+' + cleaned;
  };

  const parsePreview = async (file: File) => {
    try {
      if (file.name.endsWith('.xlsx')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        const phones = jsonData.slice(1, 6).map(row => {
          const phone = String(row[0] || '').trim();
          return formatPhoneNumber(phone);
        }).filter(phone => phone.length > 4);
        
        setPreview(phones);
      } else {
        const text = await file.text();
        const lines = text.split('\n').slice(1, 6);
        const phones = lines.map(line => {
          const phone = line.split(',')[0]?.trim() || '';
          return formatPhoneNumber(phone);
        }).filter(phone => phone.length > 4);
        
        setPreview(phones);
      }
    } catch (error) {
      console.error('Error parsing preview:', error);
      toast.error('Failed to parse file preview');
    }
  };

  const handleImport = async () => {
    if (!file || !agentId) {
      toast.error('Please select a file and agent');
      return;
    }

    setImporting(true);

    try {
      let phoneNumbers: string[] = [];

      if (file.name.endsWith('.xlsx')) {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        phoneNumbers = jsonData.slice(1).map(row => {
          const phone = String(row[0] || '').trim();
          return formatPhoneNumber(phone);
        }).filter(phone => phone.length > 4);
      } else {
        const text = await file.text();
        const lines = text.split('\n').slice(1);
        phoneNumbers = lines.map(line => {
          const phone = line.split(',')[0]?.trim() || '';
          return formatPhoneNumber(phone);
        }).filter(phone => phone.length > 4);
      }

      if (phoneNumbers.length === 0) {
        toast.error('No valid phone numbers found in file');
        setImporting(false);
        return;
      }

      // Create leads with phone numbers assigned to agent
      const leadsToInsert = phoneNumbers.map(phone => ({
        name: phone,
        phone: phone,
        segment: 'semi-active',
        user_id: agentId,
        assigned_at: new Date().toISOString(),
        priority: 'medium'
      }));

      // Insert in batches
      const batchSize = 100;
      let totalInserted = 0;

      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        const { error } = await supabase
          .from('leads')
          .insert(batch);

        if (error) {
          console.error('Batch insert error:', error);
          continue;
        }
        
        totalInserted += batch.length;
      }

      toast.success(`Successfully imported ${totalInserted} leads for ${agentName}`);
      setFile(null);
      setPreview([]);
      onOpenChange(false);
      onImportComplete();
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Leads for {agentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">Upload CSV/Excel File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileChange}
                disabled={importing}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={!file}
              >
                {file ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Upload a CSV or Excel file with phone numbers in the first column. 
              Phone numbers should be in format: +256773048864 or 0773048864
            </AlertDescription>
          </Alert>

          {preview.length > 0 && (
            <div className="space-y-2">
              <Label>Preview (first 5 numbers)</Label>
              <div className="rounded-md border p-3 bg-muted/50">
                {preview.map((phone, idx) => (
                  <div key={idx} className="text-sm font-mono py-1">
                    {phone}
                  </div>
                ))}
              </div>
            </div>
          )}

          {importing && (
            <div className="text-center text-sm text-muted-foreground">
              Importing leads... This may take a moment.
            </div>
          )}
        </div>

        <DialogFooter>
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
            {importing ? 'Importing...' : 'Import Leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
