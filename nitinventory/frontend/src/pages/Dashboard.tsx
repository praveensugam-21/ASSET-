import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, BarChart3, LayoutGrid, ArrowRight, CheckCircle, Wrench, AlertTriangle } from "lucide-react";
import { assetsApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  colorClass: string;
  borderClass: string;
  bgClass: string;
}> = ({ icon, label, value, colorClass, borderClass, bgClass }) => (
  <div
    className={`card p-5 border-l-4 ${borderClass} ${bgClass} transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
  >
    <div className="flex items-center justify-between mb-2">
      <div className="text-3xl font-black text-slate-800 tracking-tight">
        {value}
      </div>
      <div className={colorClass}>{icon}</div>
    </div>
    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
      {label}
    </div>
  </div>
);

export const DashboardPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["assets-dashboard-stats"],
    queryFn: () => assetsApi.dashboardStats().then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center flex-col gap-2">
        <div className="w-10 h-10 rounded-full border-2 border-[#1a3a6b] border-t-transparent animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
          Loading Dashboard Stats...
        </p>
      </div>
    );
  }

  const totalAssets = stats?.total_assets || 0;

  // Mapping labels to custom display
  const categoryLabels: Record<string, string> = {
    lab_equipment: "Lab Equipment",
    furniture: "Furniture",
    computer: "Computer Hardware",
    other: "Other Assets",
  };

  const conditionLabels: Record<string, string> = {
    working: "Working / Good",
    damaged: "Damaged / Broken",
    under_repair: "Under Repair",
    obsolete: "Obsolete / Scrap",
  };

  const conditionColors: Record<string, string> = {
    working: "bg-green-600",
    damaged: "bg-red-500",
    under_repair: "bg-yellow-500",
    obsolete: "bg-slate-400",
  };

  const conditionTextColors: Record<string, string> = {
    working: "text-green-700",
    damaged: "text-red-700",
    under_repair: "text-yellow-700",
    obsolete: "text-slate-600",
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1a3a6b] to-[#2b5ba3] p-6 text-white rounded-xl shadow-sm relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-10 translate-y-10">
          <Box size={240} />
        </div>
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl font-black tracking-tight">NIT Inventory</h1>
          <p className="text-sm text-blue-100 font-medium">
            Logged in as:{" "}
            <span className="font-bold underline">{user?.name}</span> | Role:{" "}
            <span className="font-bold uppercase tracking-wider">
              {user?.role?.name}
            </span>{" "}
            | Dept:{" "}
            <span className="font-bold">
              {user?.department?.name || "Central Office"}
            </span>
          </p>
        </div>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          icon={<Box size={24} />}
          label="Total Assets"
          value={totalAssets}
          colorClass="text-blue-600"
          borderClass="border-l-blue-600"
          bgClass="bg-blue-50/20"
        />
        <StatCard
          icon={<CheckCircle size={24} />}
          label="Working Assets"
          value={stats?.by_condition?.working || 0}
          colorClass="text-green-600"
          borderClass="border-l-green-600"
          bgClass="bg-green-50/20"
        />
        <StatCard
          icon={<Wrench size={24} />}
          label="Under Repair"
          value={stats?.by_condition?.under_repair || 0}
          colorClass="text-yellow-600"
          borderClass="border-l-yellow-600"
          bgClass="bg-yellow-50/20"
        />
        <StatCard
          icon={<AlertTriangle size={24} />}
          label="Obsolete Assets"
          value={stats?.by_condition?.obsolete || 0}
          colorClass="text-slate-600"
          borderClass="border-l-slate-600"
          bgClass="bg-slate-50/20"
        />
      </div>

      {/* Visual Analytics grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets by Category */}
        <div className="card p-6 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
              <LayoutGrid size={18} className="text-blue-800" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Assets by Category
              </h3>
            </div>
            <div className="space-y-4">
              {Object.entries(categoryLabels).map(([catKey, label]) => {
                const count = stats?.by_category?.[catKey] || 0;
                const percentage =
                  totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
                return (
                  <div key={catKey} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span>{label}</span>
                      <span>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-blue-800 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Assets by Condition */}
        <div className="card p-6 rounded-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-5 border-b border-slate-100 pb-3">
              <BarChart3 size={18} className="text-blue-800" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                Assets by Condition
              </h3>
            </div>
            <div className="space-y-4">
              {Object.entries(conditionLabels).map(([condKey, label]) => {
                const count = stats?.by_condition?.[condKey] || 0;
                const percentage =
                  totalAssets > 0 ? Math.round((count / totalAssets) * 100) : 0;
                const color = conditionColors[condKey] || "bg-slate-500";
                const textCol =
                  conditionTextColors[condKey] || "text-slate-800";
                return (
                  <div key={condKey} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-slate-700">
                      <span className={`${textCol}`}>{label}</span>
                      <span>
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`${color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Global breakdown table for Admin / Dev users */}
      {stats?.by_department && Object.keys(stats.by_department).length > 0 && (
        <div className="card p-6 rounded-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <BarChart3 size={18} className="text-blue-800" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Assets by Department
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(stats.by_department).map(([dept, count]) => (
              <div
                key={dept}
                className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center hover:bg-slate-100 transition-colors"
              >
                <span className="text-xs font-bold text-slate-700 truncate mr-2">
                  {dept}
                </span>
                <span className="text-xs font-black bg-blue-100 text-blue-900 px-2 py-0.5 rounded">
                  {count as number}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Added Assets */}
      <div className="card rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
            Recently Added Assets
          </h3>
          <Link
            to="/assets"
            className="text-xs font-bold text-[#1a3a6b] hover:underline flex items-center gap-0.5"
          >
            View All Assets <ArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200 bg-slate-50/30 uppercase tracking-wider">
                <th className="text-left px-6 py-3 font-semibold">Asset Tag</th>
                <th className="text-left px-6 py-3 font-semibold">
                  Asset Name
                </th>
                <th className="text-left px-6 py-3 font-semibold">Category</th>
                <th className="text-left px-6 py-3 font-semibold">Condition</th>
                <th className="text-left px-6 py-3 font-semibold">
                  Registered Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {stats?.recent_assets?.map((asset: any) => (
                <tr
                  key={asset.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-3 font-bold font-mono text-[#1a3a6b]">
                    <Link
                      to={`/assets/${asset.id}`}
                      className="hover:underline"
                    >
                      {asset.asset_tag}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-slate-800 font-semibold uppercase">
                    {asset.name}
                  </td>
                  <td className="px-6 py-3 text-slate-600 capitalize text-xs">
                    {categoryLabels[asset.category] || asset.category}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border capitalize ${
                        asset.condition === "working"
                          ? "bg-green-100 text-green-800 border-green-300"
                          : asset.condition === "damaged"
                            ? "bg-red-100 text-red-800 border-red-300"
                            : asset.condition === "under_repair"
                              ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                              : "bg-slate-100 text-slate-800 border-slate-300"
                      }`}
                    >
                      {asset.condition.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500 font-medium">
                    {new Date(asset.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {(!stats?.recent_assets || stats.recent_assets.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-10 text-center text-sm text-slate-500 font-medium"
                  >
                    No assets registered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
