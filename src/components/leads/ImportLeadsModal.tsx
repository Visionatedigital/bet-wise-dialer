import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
  userId: string;
}

export function ImportLeadsModal({ open, onOpenChange, onImportComplete, userId }: ImportLeadsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{ name: string; phone: string }[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file');
        return;
      }
      setFile(selectedFile);
      parseCSVPreview(selectedFile);
    }
  };

  const parseCSVPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
      
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const phoneIndex = headers.findIndex(h => h.includes('phone'));

      if (nameIndex === -1 || phoneIndex === -1) {
        toast.error('CSV must contain "name" and "phone" columns');
        setFile(null);
        return;
      }

      const previewData = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          name: values[nameIndex] || '',
          phone: values[phoneIndex] || ''
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
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        
        const nameIndex = headers.findIndex(h => h.includes('name'));
        const phoneIndex = headers.findIndex(h => h.includes('phone'));

        const leads = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          return {
            user_id: userId,
            name: values[nameIndex] || 'Unknown',
            phone: values[phoneIndex] || '',
            segment: 'dormant',
            priority: 'low',
            score: 0,
            tags: []
          };
        }).filter(lead => lead.name && lead.phone);

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
    } catch (error) {
      console.error('Error importing leads:', error);
      toast.error('Failed to import leads');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns "name" and "phone" to import your leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="csv-file">CSV File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
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
              <strong>CSV Format:</strong> Your file should have headers in the first row with at least "name" and "phone" columns.
              Example: name,phone
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
