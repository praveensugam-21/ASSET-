import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { User, Department } from '../../types';

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isHod: boolean;
  isAdmin: boolean;
  user: User | null;
  departments: Department[];
  onSubmit: (data: any) => void;
  isPending: boolean;
  asset?: any;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  isHod,
  isAdmin,
  user,
  departments,
  onSubmit,
  isPending,
  asset,
}) => {
  // ── Core Identity ──────────────────────────────────────────────────────────
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [legacyAssetTag, setLegacyAssetTag] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('lab_equipment');
  const [deptId, setDeptId] = useState('');
  const [assetSource, setAssetSource] = useState('legacy');

  // ── Purchase Info ──────────────────────────────────────────────────────────
  const [fundSource, setFundSource] = useState('plan_fund');
  const [unitCost, setUnitCost] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');

  // ── Supplier & Bill ────────────────────────────────────────────────────────
  const [supplierName, setSupplierName] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  // ── Stock Register ─────────────────────────────────────────────────────────
  const [stockRegisterVolume, setStockRegisterVolume] = useState('');
  const [stockRegisterPage, setStockRegisterPage] = useState('');

  // ── Physical Details ───────────────────────────────────────────────────────
  const [building, setBuilding] = useState('');
  const [room, setRoom] = useState('');
  const [custodian, setCustodian] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [condition, setCondition] = useState('working');
  const [remarks, setRemarks] = useState('');

  // Pre-fill when editing
  useEffect(() => {
    const fmt = (d: string) => (d ? d.split('T')[0] : '');

    if (asset) {
      let yr = new Date().getFullYear().toString();
      if (asset.asset_tag) {
        const parts = asset.asset_tag.split('-');
        if (parts.length >= 3 && /^\d{2}$/.test(parts[2])) yr = `20${parts[2]}`;
      }
      setYear(yr);
      setLegacyAssetTag(asset.legacy_asset_tag || '');
      setFundSource(asset.fund_source || 'plan_fund');
      setName(asset.name || '');
      setCategory(asset.category || 'lab_equipment');
      setBuilding(asset.building || '');
      setRoom(asset.room || '');
      setCustodian(asset.custodian || '');
      setSerialNumber(asset.serial_number || '');
      setCondition(asset.condition || 'working');
      setPurchaseDate(fmt(asset.purchase_date));
      setUnitCost(asset.unit_cost != null ? asset.unit_cost.toString() : '');
      setWarrantyExpiry(fmt(asset.warranty_expiry));
      setDeptId(asset.department_id ? asset.department_id.toString() : (user?.department_id?.toString() || ''));
      setRemarks(asset.remarks || '');
      setAssetSource(asset.asset_source || 'legacy');
      setQuantity(asset.quantity != null ? asset.quantity.toString() : '1');
      setSupplierName(asset.supplier_name || '');
      setSupplierAddress(asset.supplier_address || '');
      setBillNumber(asset.bill_number || '');
      setBillDate(fmt(asset.bill_date));
      setDeliveryDate(fmt(asset.delivery_date));
      setStockRegisterVolume(asset.stock_register_volume || '');
      setStockRegisterPage(asset.stock_register_page || '');
    } else {
      setYear(new Date().getFullYear().toString());
      setLegacyAssetTag('');
      setFundSource('plan_fund');
      setName('');
      setCategory('lab_equipment');
      setBuilding('');
      setRoom('');
      setCustodian('');
      setSerialNumber('');
      setCondition('working');
      setPurchaseDate('');
      setUnitCost('');
      setWarrantyExpiry('');
      setRemarks('');
      setAssetSource('legacy');
      setQuantity('1');
      setSupplierName('');
      setSupplierAddress('');
      setBillNumber('');
      setBillDate('');
      setDeliveryDate('');
      setStockRegisterVolume('');
      setStockRegisterPage('');
      if (user?.department?.id) {
        setDeptId(user.department.id.toString());
      } else {
        setDeptId('');
      }
    }
  }, [asset, isOpen, user]);

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    if (newYear.length === 4 && /^\d{4}$/.test(newYear)) {
      if (purchaseDate) {
        const parts = purchaseDate.split('-');
        if (parts.length === 3) setPurchaseDate(`${newYear}-${parts[1]}-${parts[2]}`);
      } else {
        setPurchaseDate(`${newYear}-01-01`);
      }
    }
  };

  const handlePurchaseDateChange = (newDate: string) => {
    setPurchaseDate(newDate);
    if (newDate) {
      const parts = newDate.split('-');
      if (parts.length === 3 && parts[0].length === 4) setYear(parts[0]);
    }
  };

  const getDeptShortCode = () => {
    if (isHod) return user?.department?.short_code || 'DEPT';
    const d = departments.find((dept: any) => dept.id === parseInt(deptId));
    return d?.short_code || 'DEPT';
  };

  const previewTag = `NIT-${getDeptShortCode()}-${year ? year.slice(-2) : 'YY'}-XXX`;

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      year,
      legacyAssetTag,
      fundSource,
      name,
      category,
      building,
      room,
      custodian,
      serialNumber,
      condition,
      purchaseDate,
      unitCost,
      warrantyExpiry,
      deptId,
      remarks,
      assetSource,
      quantity,
      supplierName,
      supplierAddress,
      billNumber,
      billDate,
      deliveryDate,
      stockRegisterVolume,
      stockRegisterPage,
    });
  };

  if (!isOpen) return null;

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="col-span-full pt-2 pb-1 border-b border-slate-200 mb-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600">{title}</p>
    </div>
  );

  const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl my-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-700 to-indigo-700">
          <div>
            <h2 className="text-lg font-bold text-white">{asset ? 'Edit Asset' : 'Register Asset'}</h2>
            <p className="text-xs text-indigo-200">{asset ? 'Update the physical asset details' : 'Add a physical asset into the department register'}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-md hover:bg-white/10">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* ── SECTION: Asset Identification ── */}
            <SectionHeader title="Asset Identification" />

            <div>
              <Label required>Asset Year</Label>
              <input
                type="number"
                value={year}
                onChange={e => handleYearChange(e.target.value)}
                min="1990"
                max="2100"
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <Label required>Existing Asset / Reference Number</Label>
              <input
                type="text"
                value={legacyAssetTag}
                onChange={e => setLegacyAssetTag(e.target.value)}
                placeholder="e.g. OLD-TAG-123"
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <Label>Asset Tag Preview</Label>
              <input
                type="text"
                value={previewTag}
                className="input-field w-full bg-slate-100 text-slate-500 cursor-not-allowed font-mono text-xs font-bold"
                disabled
              />
            </div>

            <div>
              <Label required>Department</Label>
              {isHod ? (
                <input
                  type="text"
                  value={user?.department?.name || ''}
                  className="input-field w-full bg-slate-100 text-slate-500 cursor-not-allowed"
                  disabled
                />
              ) : (
                <select
                  value={deptId}
                  onChange={e => setDeptId(e.target.value)}
                  className="input-field w-full"
                  required
                >
                  <option value="">Select Department...</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="col-span-full">
              <Label required>Asset Name / Description</Label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. High-Performance GPU Workstation"
                className="input-field w-full"
                required
              />
            </div>

            <div>
              <Label required>Category</Label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="input-field w-full"
              >
                <option value="lab_equipment">Lab Equipment</option>
                <option value="furniture">Furniture</option>
                <option value="computer">Computer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label>Asset Source</Label>
              <select
                value={assetSource}
                onChange={e => setAssetSource(e.target.value)}
                className="input-field w-full"
              >
                <option value="legacy">Legacy Asset</option>
                <option value="iris">Procured Through NIT Inventory</option>
              </select>
            </div>

            {/* ── SECTION: Purchase & Financial ── */}
            <SectionHeader title="Purchase & Financial Details" />

            <div>
              <Label>Funding Source</Label>
              <select
                value={fundSource}
                onChange={e => setFundSource(e.target.value)}
                className="input-field w-full"
              >
                <option value="plan_fund">Plan Fund</option>
                <option value="non_plan_fund">Non-Plan Fund</option>
                <option value="research_fund">Research Fund</option>
                <option value="consultancy_fund">Consultancy Fund</option>
                <option value="dept_development_fund">DDF</option>
                <option value="others">Others</option>
              </select>
            </div>

            <div>
              <Label>Unit Cost (₹)</Label>
              <input
                type="number"
                value={unitCost}
                onChange={e => setUnitCost(e.target.value)}
                placeholder="e.g. 85000"
                className="input-field w-full"
                min="0"
                step="0.01"
              />
            </div>

            <div>
              <Label>Quantity</Label>
              <input
                type="number"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                min="1"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label>Purchase Date</Label>
              <input
                type="date"
                value={purchaseDate}
                onChange={e => handlePurchaseDateChange(e.target.value)}
                className="input-field w-full text-slate-600"
              />
            </div>

            <div>
              <Label>Warranty Expiry</Label>
              <input
                type="date"
                value={warrantyExpiry}
                onChange={e => setWarrantyExpiry(e.target.value)}
                className="input-field w-full text-slate-600"
              />
            </div>

            {/* ── SECTION: Supplier & Bill ── */}
            <SectionHeader title="Supplier & Bill Details" />

            <div>
              <Label>Supplier Name</Label>
              <input
                type="text"
                value={supplierName}
                onChange={e => setSupplierName(e.target.value)}
                placeholder="e.g. M/s. USAM TECHNOLOGY SOLUTIONS"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label>Bill Number</Label>
              <input
                type="text"
                value={billNumber}
                onChange={e => setBillNumber(e.target.value)}
                placeholder="e.g. 201156/TRY2425"
                className="input-field w-full"
              />
            </div>

            <div className="col-span-full">
              <Label>Supplier Address</Label>
              <textarea
                value={supplierAddress}
                onChange={e => setSupplierAddress(e.target.value)}
                placeholder="Enter supplier address..."
                className="input-field w-full min-h-[72px] resize-y"
              />
            </div>

            <div>
              <Label>Bill Date</Label>
              <input
                type="date"
                value={billDate}
                onChange={e => setBillDate(e.target.value)}
                className="input-field w-full text-slate-600"
              />
            </div>

            <div>
              <Label>Delivery Date</Label>
              <input
                type="date"
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                className="input-field w-full text-slate-600"
              />
            </div>

            {/* ── SECTION: Stock Register ── */}
            <SectionHeader title="Stock Register Reference" />

            <div>
              <Label>Stock Register Volume</Label>
              <input
                type="text"
                value={stockRegisterVolume}
                onChange={e => setStockRegisterVolume(e.target.value)}
                placeholder="Vol"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label>Stock Register Page</Label>
              <input
                type="text"
                value={stockRegisterPage}
                onChange={e => setStockRegisterPage(e.target.value)}
                placeholder="Page"
                className="input-field w-full"
              />
            </div>

            {/* ── SECTION: Location & Custody ── */}
            <SectionHeader title="Location & Custody" />

            <div>
              <Label>Building / Block</Label>
              <input
                type="text"
                value={building}
                onChange={e => setBuilding(e.target.value)}
                placeholder="e.g. CSE Block"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label>Room / Lab</Label>
              <input
                type="text"
                value={room}
                onChange={e => setRoom(e.target.value)}
                placeholder="e.g. Lab 2"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label>Custodian / In-Charge</Label>
              <input
                type="text"
                value={custodian}
                onChange={e => setCustodian(e.target.value)}
                placeholder="e.g. Dr. A. Kumar"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label>Manufacturer Serial Number</Label>
              <input
                type="text"
                value={serialNumber}
                onChange={e => setSerialNumber(e.target.value)}
                placeholder="e.g. SN123456789"
                className="input-field w-full"
              />
            </div>

            <div>
              <Label required>Condition</Label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                className="input-field w-full"
              >
                <option value="working">Working</option>
                <option value="damaged">Damaged</option>
                <option value="under_repair">Under Repair</option>
                <option value="obsolete">Obsolete</option>
              </select>
            </div>

            <div className="col-span-full">
              <Label>Remarks / Notes</Label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Any additional notes about this asset..."
                className="input-field w-full min-h-[72px] resize-y"
              />
            </div>

          </div>{/* end grid */}

          {/* Footer Actions */}
          <div className="flex justify-end gap-3 pt-5 mt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="btn-primary py-2 px-6 flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {asset ? 'Saving...' : 'Registering...'}
                </>
              ) : (
                asset ? 'Save Changes' : 'Register Asset'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
