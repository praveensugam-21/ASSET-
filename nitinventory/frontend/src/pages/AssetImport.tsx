import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Upload, AlertCircle, FileText, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export const AssetImportPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');

  const importMutation = useMutation({
    mutationFn: (formData: FormData) => assetsApi.importCsv(formData),
    onSuccess: (res: any) => {
      toast.success(res.data.message || 'Assets imported successfully!');
      setSuccessMsg(res.data.message || 'Successfully imported assets.');
      setImportErrors([]);
      setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      setSuccessMsg('');
      const details = err.response?.data?.detail;
      if (details && typeof details === 'object' && details.errors) {
        setImportErrors(details.errors);
        toast.error(details.message || 'CSV Import Failed');
      } else {
        toast.error(err.response?.data?.detail || 'CSV upload failed');
      }
    }
  });

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return toast.error('Please select a CSV file');
    
    const formData = new FormData();
    formData.append('file', csvFile);
    importMutation.mutate(formData);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Asset Tag',
      'Asset Name',
      'Category',
      'Department',
      'Building',
      'Room',
      'Custodian',
      'Purchase Year',
      'Condition',
      'Remarks'
    ];
    const sampleRow = [
      'OLD-TAG-CSE-101',
      'High Performance GPU Workstation',
      'computer',
      'CSE',
      'CSE Block',
      'Research Lab 1',
      'Dr. R. Pandeeswari',
      '2026',
      'working',
      'Acquired for departmental research projects'
    ];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sampleRow.join(',')].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "assets_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="page-header">Bulk Asset CSV Import</h1>
          <p className="page-subtitle">Upload multiple assets at once using our Excel/CSV template</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {successMsg && (
            <div className="card p-5 border-l-4 border-l-green-500 bg-green-50 flex items-start gap-3">
              <CheckCircle2 size={24} className="text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-green-800">Upload Successful</h4>
                <p className="text-xs text-green-700 mt-1">{successMsg}</p>
                <div className="mt-4 flex gap-3">
                  <Link to="/assets" className="btn-primary text-xs py-1.5 px-3">Go to Asset Directory</Link>
                  <button onClick={() => setSuccessMsg('')} className="btn-secondary text-xs py-1.5 px-3">Upload Another File</button>
                </div>
              </div>
            </div>
          )}

          {/* Error messages if any */}
          {importErrors.length > 0 && (
            <div className="card p-5 border-l-4 border-l-red-500 bg-red-50 text-xs space-y-2">
              <div className="font-bold flex items-center gap-1.5 text-red-900 text-sm">
                <AlertCircle size={18} className="flex-shrink-0" />
                CSV Import Validation Failed ({importErrors.length} error(s)):
              </div>
              <p className="text-red-700">The entire import has been aborted and rolled back. Please fix these errors and try again:</p>
              <ul className="list-disc pl-5 space-y-1 max-h-60 overflow-y-auto text-red-800 font-medium">
                {importErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="card p-6">
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100/50 transition-colors relative">
                <Upload size={32} className="text-slate-400 mb-3" />
                {csvFile ? (
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">{csvFile.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{(csvFile.size / 1024).toFixed(2)} KB</p>
                    <button 
                      type="button" 
                      onClick={() => setCsvFile(null)}
                      className="text-xs font-bold text-red-600 hover:underline mt-2 block mx-auto"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-600">Drag and drop your CSV file here, or <span className="text-[#1a3a6b] font-bold cursor-pointer hover:underline">browse</span></p>
                    <p className="text-xs text-slate-400 mt-1">Accepts only .csv files</p>
                  </div>
                )}
                <input
                  type="file"
                  accept=".csv"
                  onChange={e => setCsvFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  disabled={importMutation.isPending}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => navigate('/assets')}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importMutation.isPending || !csvFile}
                  className="btn-primary flex items-center gap-2"
                >
                  {importMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Importing Records...
                    </>
                  ) : (
                    <>
                      <Upload size={16} /> Import Assets
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar instructions */}
        <div className="space-y-6">
          <div className="card p-5 bg-gradient-to-br from-[#1a3a6b] to-[#265399] text-white">
            <h3 className="text-sm font-bold flex items-center gap-1.5 mb-2"><FileText size={16} /> Download Template</h3>
            <p className="text-xs text-blue-100 mb-4 leading-relaxed">Download our pre-structured template containing the exact column names expected by the Asset Registry system.</p>
            <button
              onClick={handleDownloadTemplate}
              className="w-full bg-white text-[#1a3a6b] font-bold text-xs py-2 px-4 rounded hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5"
            >
              <Upload size={14} className="rotate-180" /> assets_template.csv
            </button>
          </div>

          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">CSV Column Guidelines</h3>
            <div className="text-xs text-slate-600 space-y-2.5">
              {[
                ['Asset Tag', 'Yes', 'Unique existing tag number / reference number from previous registries'],
                ['Asset Name', 'Yes', 'Detailed descriptive name of the physical asset'],
                ['Category', 'No', 'Must be one of: computer, lab_equipment, furniture, other'],
                ['Department', 'Yes (Admins)', 'For global admins, the department short code (e.g. CSE, EEE, ECE)'],
                ['Condition', 'No', 'Must be one of: working, damaged, under_repair, obsolete'],
                ['Remarks', 'No', 'Custom text remarks or comments to persist'],
              ].map(([col, req, desc]) => (
                <div key={col} className="space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-800 font-mono text-[11px]">{col}</span>
                    <span className={req === 'Yes' ? 'text-rose-600' : 'text-slate-400 font-normal'}>{req === 'Yes' ? 'Required' : 'Optional'}</span>
                  </div>
                  <p className="text-slate-500 leading-normal text-[10.5px]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
