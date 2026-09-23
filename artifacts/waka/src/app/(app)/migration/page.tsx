"use client";

import { useGetWorkspace, useRunAction } from "@workspace/api-client-react";
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Upload, CheckCircle2, XCircle, ArrowRight, Loader2, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { MigrationRow } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function MigrationPage() {
  const { data: workspace, refetch } = useGetWorkspace();
  const runAction = useRunAction();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState<MigrationRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{imported: number, skipped: number} | null>(null);
  
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<MigrationRow>>({});

  if (!workspace || workspace.user.role !== "ADMIN") {
    return <div className="p-8 text-center">Unauthorized. Admin access required.</div>;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csv = event.target?.result as string;
      
      runAction.mutate({
        data: {
          action: "preview_migration",
          csv
        }
      }, {
        onSuccess: (res) => {
          if (res.rows) {
            setRows(res.rows);
            setStep(2);
            toast({ title: "CSV Parsed successfully" });
          }
        },
        onError: (err: any) => {
          toast({ title: "Failed to parse CSV", description: err.message, variant: "destructive" });
        }
      });
    };
    reader.readAsText(file);
  };

  const handleToggleSkip = (index: number) => {
    const newRows = [...rows];
    newRows[index].skip = !newRows[index].skip;
    setRows(newRows);
  };
  
  const openEdit = (index: number) => {
    setEditingRowIdx(index);
    setEditForm(rows[index]);
  };
  
  const saveEdit = () => {
    if (editingRowIdx === null) return;
    const newRows = [...rows];
    newRows[editingRowIdx] = { ...newRows[editingRowIdx], ...editForm, issues: [] };
    setRows(newRows);
    setEditingRowIdx(null);
    toast({ title: "Row updated" });
  };

  const handleImport = () => {
    setImporting(true);
    runAction.mutate({
      data: {
        action: "import_migration",
        rows
      }
    }, {
      onSuccess: (res) => {
        setImportResult({ imported: res.imported || 0, skipped: res.skipped || 0 });
        setStep(3);
        setImporting(false);
        refetch();
        toast({ title: "Migration Complete" });
      },
      onError: (err: any) => {
        toast({ title: "Import Failed", description: err.message, variant: "destructive" });
        setImporting(false);
      }
    });
  };

  const validCount = rows.filter(r => r.issues.length === 0 && !r.skip).length;
  const reviewCount = rows.filter(r => r.issues.length > 0 && !r.skip).length;
  const skippedCount = rows.filter(r => r.skip).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-display font-bold uppercase tracking-tight">System Migration</h1>
        <p className="text-zinc-500">Import historical data from Fitbase</p>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-zinc-900 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}>1</div>
          <span className="uppercase tracking-widest text-xs">Read & Map</span>
        </div>
        <div className="h-px w-8 bg-zinc-200"></div>
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-zinc-900 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}>2</div>
          <span className="uppercase tracking-widest text-xs">Validate</span>
        </div>
        <div className="h-px w-8 bg-zinc-200"></div>
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-zinc-900 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}>3</div>
          <span className="uppercase tracking-widest text-xs">Import</span>
        </div>
      </div>

      {step === 1 && (
        <Card className="rounded-none border-zinc-200 shadow-none border-dashed border-2">
          <CardContent className="flex flex-col items-center justify-center py-24 space-y-4">
            <Upload className="w-12 h-12 text-zinc-300" />
            <div className="text-center">
              <h3 className="font-display font-bold text-xl uppercase tracking-widest">Upload Fitbase Export</h3>
              <p className="text-sm text-zinc-500 mt-1">Upload the fitbase_sample_export.csv file</p>
            </div>
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <div className="flex gap-4 mt-4">
              <Button onClick={() => fileInputRef.current?.click()} className="rounded-none uppercase tracking-widest font-bold">
                Select CSV File
              </Button>
              <Button variant="outline" asChild className="rounded-none uppercase tracking-widest font-bold">
                <a href="/api/sample-export.csv" download>Download Sample CSV</a>
              </Button>
            </div>
            <p className="text-[10px] text-zinc-400 mt-4 uppercase tracking-widest">Max file size: 1MB. Fictional data only.</p>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 p-4">
            <h4 className="font-bold uppercase tracking-widest text-zinc-900 mb-4 text-xs">CSV Field Mapping Applied</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">source_record_id</span> <span className="text-zinc-900">&rarr; Source ID</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">full_name</span> <span className="text-zinc-900">&rarr; Name</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">phone</span> <span className="text-zinc-900">&rarr; Phone</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">email</span> <span className="text-zinc-900">&rarr; Email</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">plan</span> <span className="text-zinc-900">&rarr; Plan</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">start_date</span> <span className="text-zinc-900">&rarr; Start Date</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">end_date</span> <span className="text-zinc-900">&rarr; End Date</span></div>
              <div className="flex flex-col"><span className="text-zinc-400 mb-1">branch_id</span> <span className="text-zinc-900">&rarr; Branch ID</span></div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="rounded-none border-zinc-200 shadow-none">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-display font-bold text-zinc-900">{rows.length}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Total Records</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-zinc-200 shadow-none">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-display font-bold text-green-600">{validCount}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Ready to Import</div>
              </CardContent>
            </Card>
            <Card className="rounded-none border-zinc-200 shadow-none">
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-display font-bold text-red-600">{reviewCount}</div>
                <div className="text-xs text-zinc-500 uppercase tracking-widest mt-1">Needs Review</div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-none border-zinc-200 shadow-none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-zinc-50 text-zinc-500 font-medium uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Source ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Membership</th>
                    <th className="px-4 py-3">Status / Issues</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className={row.skip ? 'opacity-50 bg-zinc-50' : row.issues.length > 0 ? 'bg-red-50/50' : ''}>
                      <td className="px-4 py-3 font-mono text-xs">{row.source_record_id}</td>
                      <td className="px-4 py-3 font-medium">{row.full_name}</td>
                      <td className="px-4 py-3">
                        <div>{row.phone || <span className="text-red-500 font-bold">Missing Phone</span>}</div>
                        <div className="text-xs text-zinc-500">{row.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{row.plan}</div>
                        <div className="text-xs text-zinc-500">{row.start_date} to {row.end_date}</div>
                      </td>
                      <td className="px-4 py-3">
                        {row.issues.length === 0 ? (
                          <span className="flex items-center text-green-600 text-xs font-bold uppercase tracking-widest">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Valid
                          </span>
                        ) : (
                          <div className="text-red-600 text-xs font-medium space-y-1">
                            {row.issues.map((issue: string, i: number) => (
                              <div key={i} className="flex items-start"><AlertCircle className="w-3 h-3 mr-1 mt-0.5 shrink-0" /> {issue}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {row.issues.length > 0 && !row.skip && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => openEdit(idx)}
                            className="text-[10px] font-bold uppercase tracking-widest rounded-none h-7"
                          >
                            <Edit2 className="w-3 h-3 mr-1" /> Resolve
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleToggleSkip(idx)}
                          className="text-[10px] font-bold uppercase tracking-widest rounded-none h-7"
                        >
                          {row.skip ? "Unskip" : "Skip"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-zinc-200 bg-zinc-50 flex justify-between items-center">
              <div className="text-sm text-zinc-500">
                {skippedCount} records skipped
              </div>
              <Button 
                onClick={handleImport}
                disabled={importing || validCount === 0 || reviewCount > 0}
                className="rounded-none uppercase tracking-widest font-bold"
              >
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                {reviewCount > 0 ? 'Resolve Issues First' : `Import ${validCount} Records`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {step === 3 && importResult && (
        <Card className="rounded-none border-zinc-200 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="font-display font-bold text-2xl uppercase tracking-widest">Import Successful</h3>
              <p className="text-zinc-500 mt-2">
                {importResult.imported} records imported, {importResult.skipped} records skipped.
              </p>
            </div>
            <Button onClick={() => setStep(1)} variant="outline" className="mt-8 rounded-none font-bold uppercase tracking-widest">
              Import Another File
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="mt-12">
        <h2 className="text-xl font-display font-bold uppercase tracking-tight mb-4">Migration History</h2>
        <Card className="rounded-none border-zinc-200 shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50 text-zinc-500 font-medium uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Import Date</th>
                  <th className="px-4 py-3">Source ID</th>
                  <th className="px-4 py-3">WAKA ID</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {workspace.migrations.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-zinc-500">No migration history</td></tr>
                )}
                {workspace.migrations.map((mig) => (
                  <tr key={mig.id}>
                    <td className="px-4 py-3">{format(new Date(mig.imported_at), "dd MMM yyyy HH:mm")}</td>
                    <td className="px-4 py-3 font-mono text-xs">{mig.source_record_id}</td>
                    <td className="px-4 py-3 font-mono text-xs">{mig.waka_member_id || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                        mig.status === 'IMPORTED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {mig.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Dialog open={editingRowIdx !== null} onOpenChange={(open) => !open && setEditingRowIdx(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display uppercase text-xl">Resolve Record Issues</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Full Name</label>
              <Input value={editForm.full_name || ''} onChange={e => setEditForm({...editForm, full_name: e.target.value})} className="rounded-none mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Email</label>
                <Input value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} className="rounded-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Phone</label>
                <Input value={editForm.phone || ''} onChange={e => setEditForm({...editForm, phone: e.target.value})} className="rounded-none mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Plan</label>
                <Input value={editForm.plan || ''} onChange={e => setEditForm({...editForm, plan: e.target.value})} className="rounded-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Branch ID</label>
                <Input type="number" value={editForm.branch_id || ''} onChange={e => setEditForm({...editForm, branch_id: Number(e.target.value)})} className="rounded-none mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Start Date</label>
                <Input type="date" value={editForm.start_date || ''} onChange={e => setEditForm({...editForm, start_date: e.target.value})} className="rounded-none mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">End Date</label>
                <Input type="date" value={editForm.end_date || ''} onChange={e => setEditForm({...editForm, end_date: e.target.value})} className="rounded-none mt-1" />
              </div>
            </div>
            <Button onClick={saveEdit} className="w-full rounded-none font-bold uppercase tracking-widest mt-4">
              Save and Mark Resolved
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
