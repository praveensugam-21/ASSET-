import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { assetsApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { ArrowLeft, Edit, Trash2, ArrowRightLeft, IndianRupee, Activity } from 'lucide-react';
import { AssetFormModal } from '../components/assets/AssetFormModal';

export const AssetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const isHod = user?.role?.group_key === 'hod';
  const isStores = user?.role?.group_key === 'verifier_sp';
  const isAdmin = user?.role?.group_key === 'admin';

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(Number(id)).then(res => res.data),
    enabled: !!id,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => authApi.departments().then(res => res.data),
    enabled: isHod || isAdmin,
  });

  const updateConditionMutation = useMutation({
    mutationFn: (condition: string) => assetsApi.updateCondition(Number(id), condition),
    onSuccess: () => {
      toast.success('Condition updated');
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    }
  });

  const moveMutation = useMutation({
    mutationFn: (data: any) => assetsApi.move(Number(id), data.to_building, data.to_room, data.reason),
    onSuccess: () => {
      toast.success('Asset moved successfully');
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    }
  });

  const flagDisposalMutation = useMutation({
    mutationFn: () => assetsApi.flagDisposal(Number(id)),
    onSuccess: () => {
      toast.success('Asset flagged for disposal');
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    }
  });

  const confirmDisposalMutation = useMutation({
    mutationFn: () => assetsApi.confirmDisposal(Number(id)),
    onSuccess: () => {
      toast.success('Asset disposed permanently');
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => assetsApi.delete(Number(id)),
    onSuccess: () => {
      toast.success('Asset deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate('/assets');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to delete asset');
    }
  });



  const updateMutation = useMutation({
    mutationFn: (data: any) => assetsApi.update(Number(id), data),
    onSuccess: () => {
      toast.success('Asset details updated successfully');
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update asset details');
    }
  });

  const handleMoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    moveMutation.mutate(data);
    (e.target as HTMLFormElement).reset();
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-[#1a3a6b] rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium text-sm">Loading asset details...</p>
      </div>
    );
  }
  if (!asset) return <div className="card p-8 text-center text-slate-500 font-medium">Asset not found</div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600">
          <ArrowLeft size={24} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="page-header">{asset.name}</h1>
            <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wider ${
              asset.disposal_status === 'active' ? 'bg-green-100 text-green-700' :
              asset.disposal_status === 'pending_disposal' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {asset.disposal_status.replace('_', ' ')}
            </span>
            <span className={`text-xs px-2 py-1 rounded font-bold uppercase tracking-wider ${
              asset.condition === 'working' ? 'bg-blue-100 text-blue-700' :
              asset.condition === 'damaged' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {asset.condition}
            </span>
          </div>
          <p className="page-subtitle font-mono text-slate-700 font-semibold">
            {asset.asset_tag} {asset.legacy_asset_tag ? `· Prev: ${asset.legacy_asset_tag}` : ''}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="card p-6 space-y-6">
            {/* Asset Identification */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-b border-slate-200 pb-1 mb-3">Asset Identification</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Category</p>
                  <p className="font-semibold capitalize">{asset.category?.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Existing / Legacy Tag</p>
                  <p className="font-semibold font-mono">{asset.legacy_asset_tag || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Asset Source</p>
                  <p className="font-semibold capitalize">{asset.asset_source === 'iris' ? 'Procured Through NIT Inventory' : 'Legacy Asset'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Quantity</p>
                  <p className="font-semibold">{asset.quantity ?? 1}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Manufacturer Serial No.</p>
                  <p className="font-semibold font-mono">{asset.serial_number || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Purchase & Financial */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-b border-slate-200 pb-1 mb-3">Purchase & Financial</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Funding Source</p>
                  <p className="font-semibold capitalize">{asset.fund_source?.replace(/_/g, ' ') || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Unit Cost</p>
                  <p className="font-semibold">₹{(asset.unit_cost || 0).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Purchase Date</p>
                  <p className="font-semibold">{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Warranty Expiry</p>
                  <p className="font-semibold">{asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Supplier & Bill */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-b border-slate-200 pb-1 mb-3">Supplier & Bill Details</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Supplier Name</p>
                  <p className="font-semibold">{asset.supplier_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Bill Number</p>
                  <p className="font-semibold font-mono">{asset.bill_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Bill Date</p>
                  <p className="font-semibold">{asset.bill_date ? new Date(asset.bill_date).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Delivery Date</p>
                  <p className="font-semibold">{asset.delivery_date ? new Date(asset.delivery_date).toLocaleDateString('en-IN') : 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500 mb-1">Supplier Address</p>
                  <p className="font-semibold whitespace-pre-wrap">{asset.supplier_address || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Stock Register & Location */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-b border-slate-200 pb-1 mb-3">Stock Register & Location</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Stock Register Volume</p>
                  <p className="font-semibold">{asset.stock_register_volume || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Stock Register Page</p>
                  <p className="font-semibold">{asset.stock_register_page || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Custodian</p>
                  <p className="font-semibold">{asset.custodian || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Location</p>
                  <p className="font-semibold">{asset.building || 'N/A'} – {asset.room || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 border-b border-slate-200 pb-1 mb-3">Remarks / Notes</p>
              <p className="font-semibold text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200/60 min-h-[40px] italic text-sm">
                {asset.remarks || 'No remarks provided.'}
              </p>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Activity size={18} /> Audit Log</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-white sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Performed By</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {asset.logs?.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(log.performed_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium text-slate-700 capitalize">{log.action.replace('_', ' ')}</td>
                      <td className="px-4 py-3">{log.performed_by_name}</td>
                      <td className="px-4 py-3 text-xs">
                        {log.old_value && <div className="text-slate-400">Old: {JSON.stringify(log.old_value)}</div>}
                        {log.new_value && <div className="text-slate-600">New: {JSON.stringify(log.new_value)}</div>}
                      </td>
                    </tr>
                  ))}
                  {(!asset.logs || asset.logs.length === 0) && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500 italic">No logs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-6 flex flex-col items-center border-2 border-dashed border-[#1a3a6b]/30 bg-blue-50/50">
            <h3 className="text-sm font-bold text-slate-700 mb-4 w-full text-left">Asset QR Code</h3>
            {asset.qr_code_url ? (
              <div className="bg-white p-2 rounded shadow-sm border border-slate-200 mb-4">
                <img src={asset.qr_code_url} alt="QR Code" className="w-48 h-48 object-contain" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-slate-100 flex items-center justify-center text-slate-400 mb-4 rounded">No QR</div>
            )}
            <a href={asset.qr_code_url} download={`QR_${asset.asset_tag}.png`} className="btn-secondary w-full text-center">
              Download QR Label
            </a>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Actions</h3>

            {(isHod || isAdmin) && (
              <div className="mb-6 pb-6 border-b border-slate-200">
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded font-bold text-sm bg-blue-50 border border-blue-300 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Edit size={16} /> Edit Asset Details
                </button>
              </div>
            )}
            
            {(isHod || isStores) && asset.disposal_status === 'active' && (
              <div className="mb-6 pb-6 border-b border-slate-200">
                <label className="block text-xs font-medium text-slate-700 mb-2">Update Condition</label>
                <div className="flex gap-2">
                  <select 
                    className="input-field flex-1"
                    value={asset.condition}
                    onChange={(e) => updateConditionMutation.mutate(e.target.value)}
                    disabled={updateConditionMutation.isPending}
                  >
                    <option value="working">Working/Good</option>
                    <option value="damaged">Damaged</option>
                    <option value="under_repair">Under Repair</option>
                    <option value="obsolete">Obsolete</option>
                  </select>
                </div>
              </div>
            )}

            {isHod && asset.disposal_status === 'active' && (
              <div className="mb-6 pb-6 border-b border-slate-200">
                <label className="block text-xs font-medium text-slate-700 mb-2 flex items-center gap-1"><ArrowRightLeft size={14} /> Move Asset</label>
                <form onSubmit={handleMoveSubmit} className="space-y-3">
                  <input type="text" name="to_building" required placeholder="New Building" className="input-field w-full text-sm" />
                  <input type="text" name="to_room" required placeholder="New Room" className="input-field w-full text-sm" />
                  <input type="text" name="reason" placeholder="Reason (Optional)" className="input-field w-full text-sm" />
                  <button type="submit" disabled={moveMutation.isPending} className="btn-primary w-full py-1.5 text-sm">Move</button>
                </form>
              </div>
            )}

            {isHod && asset.disposal_status === 'active' && (
              <div>
                <button 
                  onClick={() => { if(confirm('Are you sure you want to flag this asset for disposal?')) flagDisposalMutation.mutate(); }}
                  disabled={flagDisposalMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded font-medium text-sm border border-yellow-300 text-yellow-700 bg-yellow-50 hover:bg-yellow-100 transition-colors"
                >
                  <Trash2 size={16} /> Flag for Disposal
                </button>
              </div>
            )}

            {(isAdmin || isStores) && asset.disposal_status === 'pending_disposal' && (
              <div>
                <button 
                  onClick={() => { if(confirm('Permanently mark as disposed? This cannot be undone.')) confirmDisposalMutation.mutate(); }}
                  disabled={confirmDisposalMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded font-medium text-sm border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={16} /> Confirm Disposal
                </button>
              </div>
            )}
            
            {asset.disposal_status === 'disposed' && (
               <p className="text-center text-sm text-red-500 font-medium italic">Asset has been disposed.</p>
            )}

            {(isHod || isAdmin) && (
              <div className="pt-4 border-t border-slate-200 mt-4">
                <button 
                  onClick={() => { if(confirm('Are you sure you want to permanently delete this asset? This cannot be undone.')) deleteMutation.mutate(); }}
                  disabled={deleteMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded font-medium text-sm border border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors"
                >
                  <Trash2 size={16} /> Delete Asset
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AssetFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        isHod={isHod}
        isAdmin={isAdmin}
        user={user}
        departments={departments}
        onSubmit={(formData) => updateMutation.mutate({
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
        })}
        isPending={updateMutation.isPending}
        asset={asset}
      />
    </div>
  );
};
