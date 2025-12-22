import { useState, useEffect } from 'react';
import { ManagementLayout } from '@/components/layout/ManagementLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, FileText, Eye, Trash2, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import { ScrollArea } from '@/components/ui/scroll-area';

const ManagementReports = () => {
  const { user } = useAuth();
  const { isManagement, isAdmin } = useUserRole();
  const [activeTab, setActiveTab] = useState('saved');
  const [savedReports, setSavedReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [previewReport, setPreviewReport] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editedReportContent, setEditedReportContent] = useState<string>('');
  const [editedExcelData, setEditedExcelData] = useState<any>(null); // For Excel editing
  const [isSavingReport, setIsSavingReport] = useState(false);

  useEffect(() => {
    if (user) {
      fetchSavedReports();
    }
  }, [user]);


  const fetchSavedReports = async () => {
    if (!user) return;
    
    setLoadingReports(true);
    try {
      let query = supabase
        .from('generated_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      // If manager, get reports from their team
      if (isManagement && user) {
        const { data: teamAgents } = await supabase
          .from('profiles')
          .select('id')
          .eq('manager_id', user.id)
          .eq('approved', true);
        
        if (teamAgents && teamAgents.length > 0) {
          const teamAgentIds = teamAgents.map(a => a.id);
          // Include manager's own reports + team reports
          const allUserIds = [...teamAgentIds, user.id];
          query = query.in('user_id', allUserIds);
        } else {
          // No team agents, only show own reports
          query = query.eq('user_id', user.id);
        }
      } else {
        // For admins, show all reports. For others, show only their own.
        if (!isAdmin) {
          query = query.eq('user_id', user.id);
        }
      }

      const { data, error } = await query;
      if (error) {
        // Check if it's a table not found error (404/relation does not exist)
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('generated_reports table does not exist. Please apply the migration first.');
          setSavedReports([]); // Set empty array instead of showing error
          return;
        }
        throw error;
      }
      
      setSavedReports(data || []);
    } catch (error: any) {
      // Check if it's a table not found error
      if (error?.code === '42P01' || error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
        console.warn('generated_reports table does not exist. Please apply the migration first.');
        setSavedReports([]); // Set empty array instead of showing error
      } else {
        console.error('Error fetching saved reports:', error);
        toast.error('Failed to load saved reports');
      }
    } finally {
      setLoadingReports(false);
    }
  };

  const handlePreviewReport = (report: any) => {
    setPreviewReport(report);
    setEditedReportContent(report.report_content);
    setPreviewOpen(true);
    // Note: Download is only available from the preview dialog, not immediately
  };

  const handleSaveEditedReport = async () => {
    if (!previewReport || !user) return;
    
    setIsSavingReport(true);
    try {
      // For Excel files, save the edited Excel data as JSON
      const contentToSave = previewReport.file_type === 'xlsx' && editedExcelData
        ? JSON.stringify(editedExcelData)
        : editedReportContent;
      
      const { error } = await supabase
        .from('generated_reports')
        .update({
          report_content: contentToSave,
          updated_at: new Date().toISOString()
        })
        .eq('id', previewReport.id);

      if (error) {
        // Check if it's a table not found error
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('generated_reports table does not exist. Please apply the migration first.');
          toast.warning('Cannot save: Database table not found. Please apply the migration.');
          return;
        }
        throw error;
      }

      // Update local state
      const updatedReport = { 
        ...previewReport, 
        report_content: contentToSave, 
        updated_at: new Date().toISOString() 
      };
      setPreviewReport(updatedReport);
      setSavedReports(savedReports.map(r => 
        r.id === previewReport.id ? updatedReport : r
      ));

      toast.success('Report updated successfully');
    } catch (error: any) {
      console.error('Error saving edited report:', error);
      toast.error(`Failed to save report: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSavingReport(false);
    }
  };

  const handleDownloadReport = async (report: any) => {
    try {
      const fileType = report.file_type || 'docx'; // Default to docx if not specified
      
      if (fileType === 'docx') {
        // Generate Word document
        const paragraphs: any[] = [];
        
        // Title
        paragraphs.push(
          new Paragraph({
            text: report.report_title,
            heading: HeadingLevel.TITLE,
            spacing: { after: 400 },
          })
        );

        // Metadata
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Period: ${report.date_range.charAt(0).toUpperCase() + report.date_range.slice(1)}`,
                bold: true,
              }),
            ],
            spacing: { after: 100 },
          })
        );

        if (report.agent_name) {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Agent: ${report.agent_name}`,
                  bold: true,
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Generated: ${new Date(report.created_at).toLocaleDateString()}`,
                italics: true,
              }),
            ],
            spacing: { after: 400 },
          })
        );

        // Parse report content into paragraphs
        const lines = report.report_content.split('\n').filter((line: string) => line.trim().length > 0);
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (trimmedLine.endsWith(':') && trimmedLine.length < 80) {
            paragraphs.push(
              new Paragraph({
                text: trimmedLine,
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 200, after: 200 },
              })
            );
          } else if (/^\d+\.\s/.test(trimmedLine) && trimmedLine.length < 100) {
            paragraphs.push(
              new Paragraph({
                text: trimmedLine,
                heading: HeadingLevel.HEADING_2,
                spacing: { before: 200, after: 150 },
              })
            );
          } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('• ')) {
            paragraphs.push(
              new Paragraph({
                text: trimmedLine.substring(2),
                bullet: { level: 0 },
                spacing: { after: 100 },
              })
            );
          } else {
            paragraphs.push(
              new Paragraph({
                text: trimmedLine,
                spacing: { after: 150 },
              })
            );
          }
        }

        const doc = new Document({
          sections: [
            {
              properties: {},
              children: paragraphs,
            },
          ],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, report.file_name || `report-${report.id}.docx`);
        toast.success('Report downloaded successfully');
      } else if (fileType === 'xlsx') {
        // Generate Excel spreadsheet from stored JSON data using ExcelJS for better compatibility
        let excelData;
        try {
          excelData = JSON.parse(report.report_content);
        } catch (e) {
          // If not JSON, create basic structure
          excelData = {
            sheets: [{
              name: 'Summary',
              data: [
                ['Performance Report Summary'],
                [],
                ['Report Title:', report.report_title],
                ['Period:', report.date_range.charAt(0).toUpperCase() + report.date_range.slice(1)],
                ['Generated:', new Date(report.created_at).toLocaleDateString()],
                ...(report.agent_name ? [['Agent:', report.agent_name]] : []),
                [],
                ['Report Content'],
                ...report.report_content.split('\n').filter((l: string) => l.trim()).map((l: string) => [l.trim()])
              ]
            }]
          };
        }
        
        // Create Excel workbook using ExcelJS
        // Use minimal metadata for maximum Google Drive compatibility
        const excelWorkbook = new ExcelJS.Workbook();
        // Removed metadata properties that might cause Google Drive conversion issues
        // excelWorkbook.creator = 'BetSure Dialer';
        // excelWorkbook.created = new Date(report.created_at);
        // excelWorkbook.modified = new Date();
        // excelWorkbook.lastModifiedBy = 'BetSure Dialer';
        // excelWorkbook.company = 'BetSure';
        
        // Reconstruct workbook from JSON data
        excelData.sheets.forEach((sheet: any) => {
          const worksheet = excelWorkbook.addWorksheet(sheet.name);
          if (sheet.data && Array.isArray(sheet.data)) {
            sheet.data.forEach((row: any[]) => {
              worksheet.addRow(row);
            });
          }
          
          // Skip column auto-sizing for Google Drive compatibility
          // Google Drive converter has issues with column width settings
        });
        
        // Generate Excel file buffer using ExcelJS (better compatibility)
        console.log('[ExcelJS] Starting workbook write for download...', {
          sheetCount: excelWorkbook.worksheets.length,
          sheetNames: excelWorkbook.worksheets.map(ws => ws.name)
        });
        
        // Write buffer with absolute minimal options for maximum Google Drive compatibility
        // Google Drive converter is extremely strict - use the most basic format possible
        const excelBuffer = await excelWorkbook.xlsx.writeBuffer({
          useStyles: false,
          useSharedStrings: false,
          compression: false,  // Disable compression - some converters have issues with compressed files
          dateUTC: false
        });
        
        // Validate buffer is not empty and has minimum size
        if (!excelBuffer) {
          throw new Error('Generated Excel buffer is null or undefined');
        }
        
        const bufferSize = excelBuffer instanceof ArrayBuffer 
          ? excelBuffer.byteLength 
          : (excelBuffer as any).length || 0;
          
        if (bufferSize === 0) {
          throw new Error('Generated Excel buffer is empty');
        }
        
        console.log('[ExcelJS] Buffer generated successfully', {
          bufferType: excelBuffer.constructor.name,
          byteLength: bufferSize
        });
        
        // Convert to Uint8Array if needed for Blob compatibility
        let finalBuffer: ArrayBuffer | Uint8Array;
        if (excelBuffer instanceof ArrayBuffer) {
          finalBuffer = excelBuffer;
        } else if (excelBuffer instanceof Uint8Array) {
          finalBuffer = excelBuffer;
        } else {
          // Fallback: convert to Uint8Array
          finalBuffer = new Uint8Array(excelBuffer as any);
        }
        
        // Create Blob with explicit MIME type for maximum compatibility
        const blob = new Blob([finalBuffer], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        console.log('[ExcelJS] Blob created successfully', {
          blobSize: blob.size,
          blobType: blob.type,
          fileName: report.file_name
        });
        
        if (blob.size === 0) {
          throw new Error('Generated blob is empty');
        }
        
        saveAs(blob, report.file_name || `report-${report.id}.xlsx`);
        toast.success('Report downloaded successfully');
      } else if (fileType === 'csv') {
        // CSV files are stored as plain text in report_content
        const csvContent = report.report_content || '';
        // Ensure proper UTF-8 encoding with BOM for Excel/Google Sheets
        const csvWithBOM = '\ufeff' + csvContent;
        const csvBlob = new Blob([csvWithBOM], { 
          type: 'text/csv;charset=utf-8;' 
        });
        saveAs(csvBlob, report.file_name || `report-${report.id}.csv`);
        toast.success('Report downloaded successfully');
      } else if (fileType === 'pdf') {
        // Generate PDF
        const pdf = new jsPDF();
        let yPos = 20;
        const pageHeight = pdf.internal.pageSize.height;
        const margin = 20;
        const lineHeight = 7;
        
        // Title
        pdf.setFontSize(18);
        pdf.text(report.report_title, margin, yPos);
        yPos += 15;
        
        // Metadata
        pdf.setFontSize(12);
        pdf.text(`Period: ${report.date_range.charAt(0).toUpperCase() + report.date_range.slice(1)}`, margin, yPos);
        yPos += 10;
        pdf.text(`Generated: ${new Date(report.created_at).toLocaleDateString()}`, margin, yPos);
        yPos += 15;
        
        if (report.agent_name) {
          pdf.text(`Agent: ${report.agent_name}`, margin, yPos);
          yPos += 10;
        }
        
        // Add report content
        pdf.setFontSize(10);
        const lines = report.report_content.split('\n');
        lines.forEach((line: string) => {
          if (yPos > pageHeight - margin) {
            pdf.addPage();
            yPos = margin;
          }
          
          const trimmedLine = line.trim();
          if (trimmedLine) {
            if (trimmedLine.endsWith(':') && trimmedLine.length < 80) {
              // Section header
              pdf.setFontSize(12);
              pdf.setFont(undefined, 'bold');
              pdf.text(trimmedLine, margin, yPos);
              yPos += 10;
              pdf.setFontSize(10);
              pdf.setFont(undefined, 'normal');
            } else {
              pdf.text(trimmedLine, margin, yPos);
              yPos += lineHeight;
            }
          } else {
            yPos += 5; // Space for empty lines
          }
        });
        
        const blob = pdf.output('blob');
        saveAs(blob, report.file_name || `report-${report.id}.pdf`);
        toast.success('Report downloaded successfully');
      }
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) return;
    
    try {
      const { error } = await supabase
        .from('generated_reports')
        .delete()
        .eq('id', reportId);
      
      if (error) throw error;
      
      toast.success('Report deleted successfully');
      fetchSavedReports();
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report');
    }
  };

  return (
    <ManagementLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Generated Reports</h1>
            <p className="text-muted-foreground">View, edit, and download previously generated performance reports</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="saved">Generated Reports ({savedReports.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Generated Reports
              </CardTitle>
                <p className="text-sm text-muted-foreground">
                  View and download previously generated performance reports
                </p>
            </CardHeader>
            <CardContent>
                {loadingReports ? (
                  <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
                ) : savedReports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No reports generated yet. Generate a report from the Performance Analytics page to see it here.
                      </div>
                ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                        <TableHead>Report Title</TableHead>
                        <TableHead>Date Range</TableHead>
                    <TableHead>Agent</TableHead>
                        <TableHead>Format</TableHead>
                        <TableHead>Generated</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                      {savedReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{report.report_title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {report.date_range.charAt(0).toUpperCase() + report.date_range.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {report.agent_name || 'All Agents'}
                          </TableCell>
                      <TableCell>
                            <Badge variant="outline">
                              {(() => {
                                // Use file_type if available, otherwise extract from file_name
                                if (report.file_type) {
                                  return report.file_type.toUpperCase();
                                }
                                // Fallback: extract extension from file_name
                                const extension = report.file_name?.split('.').pop()?.toLowerCase();
                                if (extension === 'csv') {
                                  return 'CSV';
                                } else if (extension === 'xlsx' || extension === 'xls') {
                                  return 'XLSX';
                                } else if (extension === 'pdf') {
                                  return 'PDF';
                                } else {
                                  return 'DOCX';
                                }
                              })()}
                        </Badge>
                      </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              {new Date(report.created_at).toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePreviewReport(report)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Preview & Download
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReport(report.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                )}
            </CardContent>
          </Card>
          </TabsContent>
        </Tabs>

        {/* Report Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                {previewReport?.report_title}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Preview and edit the report content below. You can download the report after reviewing it.
                {previewReport?.file_type && (
                  <span className="ml-2">
                    Format: <strong>{(previewReport.file_type || 'docx').toUpperCase()}</strong>
                  </span>
                )}
              </p>
            </DialogHeader>
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Generated: {previewReport && new Date(previewReport.created_at).toLocaleString()}</span>
                </div>
                <Badge variant="secondary">
                  {previewReport?.date_range.charAt(0).toUpperCase() + previewReport?.date_range.slice(1)}
                </Badge>
                {previewReport?.agent_name && (
                  <Badge variant="outline">Agent: {previewReport.agent_name}</Badge>
                )}
                {previewReport?.updated_at && previewReport.updated_at !== previewReport.created_at && (
                  <Badge variant="outline" className="text-xs">
                    Updated: {new Date(previewReport.updated_at).toLocaleString()}
                  </Badge>
                )}
              </div>
              <div className="flex-1 overflow-hidden border rounded-lg">
                {previewReport?.file_type === 'xlsx' && editedExcelData ? (
                  // Excel Preview - Show editable tables
                  <ScrollArea className="h-full">
                    <Tabs defaultValue={editedExcelData.sheets[0]?.name || 'Summary'} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        {editedExcelData.sheets.map((sheet: any) => (
                          <TabsTrigger key={sheet.name} value={sheet.name}>
                            {sheet.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {editedExcelData.sheets.map((sheet: any) => (
                        <TabsContent key={sheet.name} value={sheet.name} className="mt-4">
                          <div className="border rounded-lg overflow-auto">
                            <Table>
                              <TableHeader>
                                {sheet.data[0] && (
                                  <TableRow>
                                    {sheet.data[0].map((header: any, idx: number) => (
                                      <TableHead key={idx} className="bg-muted font-semibold">
                                        {String(header || '')}
                                      </TableHead>
                                    ))}
                                  </TableRow>
                                )}
                              </TableHeader>
                              <TableBody>
                                {sheet.data.slice(1).map((row: any[], rowIdx: number) => (
                                  <TableRow key={rowIdx}>
                                    {row.map((cell: any, cellIdx: number) => (
                                      <TableCell key={cellIdx}>
                                        <input
                                          type="text"
                                          value={String(cell || '')}
                                          onChange={(e) => {
                                            const newData = JSON.parse(JSON.stringify(editedExcelData));
                                            newData.sheets.find((s: any) => s.name === sheet.name).data[rowIdx + 1][cellIdx] = e.target.value;
                                            setEditedExcelData(newData);
                                          }}
                                          className="w-full border-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary px-2 py-1"
                                        />
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </ScrollArea>
                ) : (
                  // Text/Word/PDF Preview - Show textarea
                  <Textarea
                    value={editedReportContent}
                    onChange={(e) => setEditedReportContent(e.target.value)}
                    className="h-full min-h-[400px] font-mono text-sm resize-none border-0 rounded-lg"
                    placeholder="Report content will appear here..."
                  />
                )}
              </div>
              <div className="flex justify-between items-center gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    // Reset to original content
                    if (previewReport) {
                      setEditedReportContent(previewReport.report_content);
                    }
                  }}
                  disabled={isSavingReport}
                >
                  Reset
                </Button>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setPreviewOpen(false)}
                    disabled={isSavingReport}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveEditedReport}
                    disabled={
                      isSavingReport || 
                      (previewReport?.file_type === 'xlsx' 
                        ? JSON.stringify(editedExcelData) === previewReport?.report_content
                        : editedReportContent === previewReport?.report_content)
                    }
                  >
                    {isSavingReport ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button 
                    onClick={() => {
                      if (previewReport) {
                        // Update previewReport with edited content for download
                        const updatedReport = { ...previewReport, report_content: editedReportContent };
                        handleDownloadReport(updatedReport);
                      }
                    }}
                    disabled={isSavingReport}
                    className="bg-primary text-primary-foreground"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download {previewReport?.file_type ? previewReport.file_type.toUpperCase() : 'DOCX'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ManagementLayout>
  );
};

export default ManagementReports;
