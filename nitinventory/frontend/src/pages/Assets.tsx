import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, authApi } from '../services/api';
import { Asset } from '../types';
import { Link, useParams } from 'react-router-dom';
import { Plus, Search, Filter, FileDown, FileText, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

import { AssetFormModal } from '../components/assets/AssetFormModal';
import { AssetTable } from '../components/assets/AssetTable';

const CONDITION_COLORS: Record<string, string> = {
  working: 'bg-green-100 text-green-800 border-green-300',
  damaged: 'bg-red-100 text-red-800 border-red-300',
  under_repair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  obsolete: 'bg-slate-100 text-slate-800 border-slate-300',
};

export const AssetListPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user, isHod, isAdmin } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Search & Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCondition, setFilterCondition] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFundSource, setFilterFundSource] = useState('');
  const [filterDept, setFilterDept] = useState('');

  const [page, setPage] = useState(1);
  const limit = 50;

  const { data: assetsData, isLoading } = useQuery({
    queryKey: ['assets', page, searchTerm, filterYear, filterCategory, filterCondition, filterStatus, filterFundSource, filterDept],
    queryFn: () => assetsApi.list({
      skip: (page - 1) * limit,
      limit,
      search: searchTerm || undefined,
      year: filterYear ? parseInt(filterYear) : undefined,
      category: filterCategory || undefined,
      condition: filterCondition || undefined,
      disposal_status: filterStatus || undefined,
      fund_source: filterFundSource || undefined,
      department_id: filterDept ? parseInt(filterDept) : undefined,
    }).then(r => r.data),
  });

  const assets = assetsData?.items || [];
  const total = assetsData?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => authApi.departments().then(r => r.data),
    enabled: isAdmin(),
  });

  const registerMutation = useMutation({
    mutationFn: (data: any) => assetsApi.create(data),
    onSuccess: (res: any) => {
      toast.success(res.data.message || 'Asset registered successfully');
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to register asset');
    }
  });

  const importMutation = useMutation({
    mutationFn: (formData: FormData) => assetsApi.importCsv(formData),
    onSuccess: (res: any) => {
      toast.success(res.data.message || 'Assets imported successfully');
      setIsImportModalOpen(false);
      setImportFile(null);
      setImportErrors([]);
      queryClient.invalidateQueries({ queryKey: ['assets'] });
    },
    onError: (err: any) => {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.errors) {
        setImportErrors(detail.errors);
      } else {
        toast.error(typeof detail === 'string' ? detail : 'CSV import failed');
      }
    }
  });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportExcel = async () => {
    try {
      const res = await assetsApi.exportExcel({
        search: searchTerm || undefined,
        year: filterYear ? parseInt(filterYear) : undefined,
        category: filterCategory || undefined,
        condition: filterCondition || undefined,
        disposal_status: filterStatus || undefined,
        fund_source: filterFundSource || undefined,
        department_id: filterDept ? parseInt(filterDept) : undefined,
      });
      downloadBlob(res.data, 'asset_register.xlsx');
      toast.success('Excel export downloaded');
    } catch {
      toast.error('Excel export failed');
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await assetsApi.exportPdf({
        search: searchTerm || undefined,
        year: filterYear ? parseInt(filterYear) : undefined,
        category: filterCategory || undefined,
        condition: filterCondition || undefined,
        disposal_status: filterStatus || undefined,
        fund_source: filterFundSource || undefined,
        department_id: filterDept ? parseInt(filterDept) : undefined,
      });
      downloadBlob(res.data, 'asset_register.pdf');
      toast.success('PDF export downloaded');
    } catch {
      toast.error('PDF export failed');
    }
  };

  const handleRegisterSubmit = (formData: any) => {
    if (!formData.name.trim()) return toast.error('Asset Name is required');
    if (!formData.legacyAssetTag.trim()) return toast.error('Existing Asset Number is required');
    if (!formData.year.trim()) return toast.error('Year is required');
    if (!formData.deptId) return toast.error('Department is required');

    registerMutation.mutate({
      year: parseInt(formData.year),
      legacy_asset_tag: formData.legacyAssetTag,
      fund_source: formData.fundSource,
      name: formData.name,
      category: formData.category,
      building: formData.building || undefined,
      room: formData.room || undefined,
      custodian: formData.custodian || undefined,
      serial_number: formData.serialNumber || undefined,
      condition: formData.condition,
      purchase_date: formData.purchaseDate || undefined,
      unit_cost: formData.unitCost ? parseFloat(formData.unitCost) : undefined,
      warranty_expiry: formData.warrantyExpiry || undefined,
      department_id: parseInt(formData.deptId),
      remarks: formData.remarks || undefined,
      asset_source: formData.assetSource || undefined,
      quantity: formData.quantity ? parseInt(formData.quantity) : 1,
      supplier_name: formData.supplierName || undefined,
      supplier_address: formData.supplierAddress || undefined,
      bill_number: formData.billNumber || undefined,
      bill_date: formData.billDate || undefined,
      delivery_date: formData.deliveryDate || undefined,
      stock_register_volume: formData.stockRegisterVolume || undefined,
      stock_register_page: formData.stockRegisterPage || undefined,
    });
  };

  const handleImportSubmit = () => {
    if (!importFile) return toast.error('Please select a CSV file');
    setImportErrors([]);
    const formData = new FormData();
    formData.append('file', importFile);
    importMutation.mutate(formData);
  };

  const handleDownloadTemplate = () => {
    // All columns in the EXACT same order as the Register Asset form
    // (clean array — no inline comments to avoid CSV corruption)
    const headers = [
      // Asset Identification
      'purchase_year', 'existing_asset_no', 'name', 'category', 'asset_source', 'department',
      // Purchase & Financial
      'fund_source', 'unit_cost', 'quantity', 'purchase_date', 'warranty_expiry',
      // Supplier & Bill
      'supplier_name', 'bill_number', 'supplier_address', 'bill_date', 'delivery_date',
      // Stock Register
      'stock_register_volume', 'stock_register_page',
      // Location & Custody
      'building', 'room', 'custodian', 'serial_number', 'condition', 'remarks',
    ];

    const sampleRow = [
      // ─── Asset Identification ───
      '2026',                               // purchase_year
      'OLD-TAG-001',                        // existing_asset_no (REQUIRED)
      'Dell Latitude 7420 Laptop i7',       // name (REQUIRED)
      'computer',                           // category: lab_equipment | furniture | computer | other
      'legacy',                             // asset_source: legacy | iris
      'CSE',                                // department: dept short code (admin only)
      // ─── Purchase & Financial ───
      'plan_fund',                          // fund_source: plan_fund | non_plan_fund | research_fund | consultancy_fund | dept_development_fund | others
      '85000',                              // unit_cost (in rupees, no commas)
      '1',                                  // quantity
      '2026-01-15',                         // purchase_date (YYYY-MM-DD)
      '2028-01-15',                         // warranty_expiry (YYYY-MM-DD)
      // ─── Supplier & Bill ───
      'M/s USAM Technology Solutions',      // supplier_name
      '201156/TRY2425',                     // bill_number
      '123 Anna Salai Chennai 600002',      // supplier_address
      '2026-01-10',                         // bill_date (YYYY-MM-DD)
      '2026-01-15',                         // delivery_date (YYYY-MM-DD)
      // ─── Stock Register ───
      'Vol 1',                              // stock_register_volume
      'Page 5',                             // stock_register_page
      // ─── Location & Custody ───
      'CSE Block',                          // building
      'Computer Lab 2',                     // room
      'Dr. A. Kumar',                       // custodian
      'SN-DELL-7420-123456',               // serial_number
      'working',                            // condition: working | damaged | under_repair | obsolete
      'Good condition asset',               // remarks
    ];

    // CSV-safe quoting: wrap values containing commas, quotes, or newlines
    const csvQuote = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;

    const notesRow = [
      // Asset Identification
      'e.g. 2026', 'e.g. OLD-TAG-001 (REQUIRED)', 'e.g. Dell Laptop (REQUIRED)',
      'lab_equipment|furniture|computer|other', 'legacy|iris', 'Dept code e.g. CSE (Admin only)',
      // Purchase & Financial
      'plan_fund|non_plan_fund|research_fund|...', 'e.g. 85000 (no commas)', 'e.g. 1',
      'YYYY-MM-DD', 'YYYY-MM-DD',
      // Supplier & Bill
      'Supplier name', 'e.g. 201156/TRY2425', 'Supplier address',
      'YYYY-MM-DD', 'YYYY-MM-DD',
      // Stock Register
      'e.g. Vol 1', 'e.g. Page 5',
      // Location & Custody
      'e.g. CSE Block', 'e.g. Lab 2', 'e.g. Dr. A. Kumar',
      'Manufacturer S/N', 'working|damaged|under_repair|obsolete', 'Any notes',
    ];

    const csv = [
      headers.map(csvQuote).join(','),
      notesRow.map(csvQuote).join(','),
      sampleRow.map(csvQuote).join(','),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, 'asset_import_template.csv');
  };


  const canRegister = isHod() || isAdmin();

  // Extract unique years from assets dynamically
  const uniqueYears = Array.from(new Set(assets.map((asset: any) => {
    const parts = asset.asset_tag.split('-');
    if (parts.length >= 3) {
      const yy = parts[2];
      if (/^\d{2}$/.test(yy)) {
        return `20${yy}`;
      }
    }
    if (asset.purchase_date) {
      return new Date(asset.purchase_date).getFullYear().toString();
    }
    return null;
  }).filter(Boolean) as string[])).sort((a, b) => b.localeCompare(a));

  const filteredAssets = assets;

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="page-header">Asset Directory</h1>
          <p className="page-subtitle">Centralized view of institutional assets</p>
        </div>
        <div className="flex gap-2 text-sm flex-wrap justify-end">
          <button
            onClick={handleExportExcel}
            className="btn-secondary flex items-center gap-2"
            title="Export current view as Excel"
          >
            <FileDown size={16} /> Excel
          </button>
          <button
            onClick={handleExportPdf}
            className="btn-secondary flex items-center gap-2"
            title="Export current view as PDF"
          >
            <FileText size={16} /> PDF
          </button>
          {canRegister && (
            <>
              <button
                onClick={() => { setIsImportModalOpen(true); setImportFile(null); setImportErrors([]); }}
                className="btn-secondary flex items-center gap-2"
                title="Bulk import assets from CSV"
              >
                <Upload size={16} /> Import CSV
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus size={18} /> Register Asset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filter Panel */}
      <div className="card p-4 bg-slate-50 border border-slate-200 shadow-sm rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-[#1a3a6b] font-bold text-xs border-b border-slate-200/60 pb-2">
          <Filter size={14} /> Filter Asset Records
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 items-center">
          <div className="relative lg:col-span-2 col-span-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-9 text-sm"
            />
          </div>

          <div>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="input-field w-full text-sm">
              <option value="">All Years</option>
              {uniqueYears.map(yr => <option key={yr} value={yr}>{yr}</option>)}
            </select>
          </div>

          <div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="input-field w-full text-sm">
              <option value="">All Categories</option>
              <option value="lab_equipment">Lab Equipment</option>
              <option value="furniture">Furniture</option>
              <option value="computer">Computer</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className="input-field w-full text-sm">
              <option value="">All Conditions</option>
              <option value="working">Working</option>
              <option value="damaged">Damaged</option>
              <option value="under_repair">Under Repair</option>
              <option value="obsolete">Obsolete</option>
            </select>
          </div>

          <div>
            <select value={filterFundSource} onChange={(e) => setFilterFundSource(e.target.value)} className="input-field w-full text-sm">
              <option value="">All Funding</option>
              <option value="plan_fund">Plan Fund</option>
              <option value="non_plan_fund">Non-Plan Fund</option>
              <option value="research_fund">Research Fund</option>
              <option value="consultancy_fund">Consultancy Fund</option>
              <option value="dept_development_fund">DDF</option>
              <option value="others">Others</option>
            </select>
          </div>

          <div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field w-full text-sm">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="flagged">Flagged</option>
              <option value="disposed">Disposed</option>
            </select>
          </div>

          {isAdmin() && (
            <div>
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="input-field w-full text-sm">
                <option value="">All Departments</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-slate-500 font-medium">Loading assets...</div>
      ) : (
        <>
          <AssetTable filteredAssets={filteredAssets} conditionColors={CONDITION_COLORS} page={page} limit={limit} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 mt-4 rounded-lg shadow-sm">
              <div className="flex flex-1 justify-between sm:hidden">
                <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Previous</button>
                <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Next</button>
              </div>
              <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                <p className="text-sm text-slate-700">
                  Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(page * limit, total)}</span> of{' '}
                  <span className="font-medium">{total}</span> assets
                </p>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                  <button onClick={() => setPage(p => Math.max(p - 1, 1))} disabled={page === 1} className="relative inline-flex items-center rounded-l-md px-3 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">Previous</button>
                  {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${p === page ? 'z-10 bg-[#1a3a6b] text-white' : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'}`}>{p}</button>
                  ))}
                  <button onClick={() => setPage(p => Math.min(p + 1, totalPages))} disabled={page === totalPages} className="relative inline-flex items-center rounded-r-md px-3 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50">Next</button>
                </nav>
              </div>
            </div>
          )}
        </>
      )}

      {/* Register Asset Modal */}
      <AssetFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isHod={isHod()}
        isAdmin={isAdmin()}
        user={user}
        departments={departments}
        onSubmit={handleRegisterSubmit}
        isPending={registerMutation.isPending}
      />

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-700 to-indigo-700 rounded-t-xl flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Bulk Import Assets (CSV)</h2>
                <p className="text-xs text-indigo-200 mt-0.5">Upload a CSV file to register multiple assets at once</p>
              </div>
              <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportErrors([]); }} className="text-white/70 hover:text-white p-1 rounded hover:bg-white/10">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Template download */}
              <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div>
                  <p className="text-sm font-bold text-indigo-800">Step 1: Download Template</p>
                  <p className="text-xs text-indigo-600 mt-0.5">Get the CSV template with all required column headers and a sample row</p>
                </div>
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap">
                  <FileDown size={14} /> Download Template
                </button>
              </div>

              {/* Column reference */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-xs font-bold text-slate-700 mb-3">📋 All Columns — same order as Register Asset form (ALL REQUIRED)</p>

                {/* Section: Asset Identification */}
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 mb-1.5 border-b border-indigo-100 pb-1">Asset Identification</p>
                  <div className="grid grid-cols-1 gap-y-1 text-xs">
                    {[
                      ['purchase_year', 'text', 'Asset year (e.g. 2026). Must be between 1990 and 2100'],
                      ['existing_asset_no', 'text', 'Existing/legacy asset reference number (e.g. OLD-TAG-001)'],
                      ['name', 'text', 'Asset name or description'],
                      ['category', 'select', 'lab_equipment | furniture | computer | other'],
                      ['asset_source', 'select', 'legacy | iris'],
                      ['department', 'text', 'Dept short code e.g. CSE (Admin only; HODs use their own dept)'],
                    ].map(([col, type, desc]) => (
                      <div key={col} className="flex gap-2 py-0.5">
                        <span className="font-mono font-bold text-indigo-700 shrink-0 w-44">{col}</span>
                        <span className="text-slate-400 shrink-0 w-12 text-center">({type})</span>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Purchase & Financial */}
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1.5 border-b border-emerald-100 pb-1">Purchase &amp; Financial Details</p>
                  <div className="grid grid-cols-1 gap-y-1 text-xs">
                    {[
                      ['fund_source', 'select', 'plan_fund | non_plan_fund | research_fund | consultancy_fund | dept_development_fund | others'],
                      ['unit_cost', 'number', 'Cost in rupees — no commas or ₹ symbol (e.g. 85000)'],
                      ['quantity', 'number', 'Number of units — positive integer (e.g. 1)'],
                      ['purchase_date', 'date', 'YYYY-MM-DD format (e.g. 2026-01-15)'],
                      ['warranty_expiry', 'date', 'YYYY-MM-DD format (e.g. 2028-01-15)'],
                    ].map(([col, type, desc]) => (
                      <div key={col} className="flex gap-2 py-0.5">
                        <span className="font-mono font-bold text-emerald-700 shrink-0 w-44">{col}</span>
                        <span className="text-slate-400 shrink-0 w-12 text-center">({type})</span>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Supplier & Bill */}
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600 mb-1.5 border-b border-orange-100 pb-1">Supplier &amp; Bill Details</p>
                  <div className="grid grid-cols-1 gap-y-1 text-xs">
                    {[
                      ['supplier_name', 'text', 'Supplier / vendor name'],
                      ['bill_number', 'text', 'Invoice or bill number (e.g. 201156/TRY2425)'],
                      ['supplier_address', 'text', 'Supplier address — wrap in quotes if it contains commas'],
                      ['bill_date', 'date', 'YYYY-MM-DD format'],
                      ['delivery_date', 'date', 'YYYY-MM-DD format'],
                    ].map(([col, type, desc]) => (
                      <div key={col} className="flex gap-2 py-0.5">
                        <span className="font-mono font-bold text-orange-700 shrink-0 w-44">{col}</span>
                        <span className="text-slate-400 shrink-0 w-12 text-center">({type})</span>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Stock Register */}
                <div className="mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1.5 border-b border-purple-100 pb-1">Stock Register Reference</p>
                  <div className="grid grid-cols-1 gap-y-1 text-xs">
                    {[
                      ['stock_register_volume', 'text', 'Volume number (e.g. Vol 1)'],
                      ['stock_register_page', 'text', 'Page number (e.g. Page 5)'],
                    ].map(([col, type, desc]) => (
                      <div key={col} className="flex gap-2 py-0.5">
                        <span className="font-mono font-bold text-purple-700 shrink-0 w-44">{col}</span>
                        <span className="text-slate-400 shrink-0 w-12 text-center">({type})</span>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Location & Custody */}
                <div className="mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-600 mb-1.5 border-b border-sky-100 pb-1">Location &amp; Custody</p>
                  <div className="grid grid-cols-1 gap-y-1 text-xs">
                    {[
                      ['building', 'text', 'Building or block name (e.g. CSE Block)'],
                      ['room', 'text', 'Room or lab name (e.g. Computer Lab 2)'],
                      ['custodian', 'text', 'Custodian or in-charge name'],
                      ['serial_number', 'text', 'Manufacturer serial number'],
                      ['condition', 'select', 'working | damaged | under_repair | obsolete'],
                      ['remarks', 'text', 'Any additional notes about the asset'],
                    ].map(([col, type, desc]) => (
                      <div key={col} className="flex gap-2 py-0.5">
                        <span className="font-mono font-bold text-sky-700 shrink-0 w-44">{col}</span>
                        <span className="text-slate-400 shrink-0 w-12 text-center">({type})</span>
                        <span className="text-slate-500">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-red-500 font-semibold mt-3 italic">⚠️ ALL columns are strictly MANDATORY. No fields can be left blank or omitted.</p>
              </div>

              {/* File drop zone */}
              <div>
                <p className="text-sm font-bold text-slate-700 mb-2">Step 2: Upload Your CSV File</p>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                    isDragging ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 hover:border-indigo-300 hover:bg-slate-50'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file && file.name.toLowerCase().endsWith('.csv')) {
                      setImportFile(file);
                      setImportErrors([]);
                    } else {
                      toast.error('Please drop a .csv file');
                    }
                  }}
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                >
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setImportFile(file); setImportErrors([]); }
                    }}
                  />
                  {importFile ? (
                    <div>
                      <div className="text-4xl mb-2">📄</div>
                      <p className="font-bold text-slate-700">{importFile.name}</p>
                      <p className="text-xs text-slate-500 mt-1">{(importFile.size / 1024).toFixed(1)} KB — Click to change file</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-4xl mb-3">📂</div>
                      <p className="font-semibold text-slate-600">Drag & drop your CSV file here</p>
                      <p className="text-xs text-slate-400 mt-1">or click to browse — only .csv files accepted</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Import errors */}
              {importErrors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                  <p className="text-sm font-bold text-red-700 mb-2">⚠ Import Failed — {importErrors.length} error(s) found:</p>
                  <ul className="space-y-1">
                    {importErrors.map((err, i) => (
                      <li key={i} className="text-xs text-red-600">• {err}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-red-500 mt-3 font-semibold italic">No assets were imported. Fix all errors and try again.</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsImportModalOpen(false); setImportFile(null); setImportErrors([]); }}
                  className="btn-secondary py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={!importFile || importMutation.isPending}
                  className="btn-primary py-2 px-6 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importMutation.isPending ? (
                    <><span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Importing...</>
                  ) : (
                    <><Upload size={16} /> Import Assets</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// Public QR profile (no auth needed)
export const AssetPublicPage: React.FC = () => {
  const { tag } = useParams<Record<string, string>>();
  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset-public', tag],
    queryFn: () => assetsApi.publicProfile(tag!).then(r => r.data),
  });

  if (isLoading) return <div className="min-h-screen formal-bg flex items-center justify-center text-slate-600 font-medium">Loading details...</div>;
  if (!asset) return <div className="min-h-screen formal-bg flex items-center justify-center text-slate-500 font-medium">Asset not found or invalid QR code.</div>;

  return (
    <div className="min-h-screen formal-bg flex items-center justify-center p-4">
      <div className="card max-w-md w-full p-8 shadow-md">
        <div className="text-center mb-6">
          <img src="/NITLOGO.png" alt="NIT Logo" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-[#1a3a6b]">{asset.name}</h1>
          <div className="text-slate-600 font-mono text-sm mt-1 font-bold">{asset.asset_tag}</div>
        </div>
        <div className="space-y-3 bg-slate-50 p-5 rounded border border-slate-200">
          {[
            ['Department', asset.department_name || '—'],
            ['Location', asset.location || '—'],
            ['Custodian', asset.custodian_name || '—'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm py-2 border-b border-slate-200 last:border-0">
              <span className="text-slate-500 font-semibold">{k}</span>
              <span className="text-slate-800 font-medium capitalize">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 pt-4 border-t border-slate-300 text-center text-xs font-medium text-slate-500">
          National Institute of Technology, Tiruchirappalli<br />
          NIT Inventory
        </div>
      </div>
    </div>
  );
};
