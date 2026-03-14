import { type LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    color: "violet" | "green" | "amber" | "red" | "blue";
}

const colorMap = {
    violet: {
        bg: "bg-violet-500/10",
        icon: "text-violet-400",
        shadow: "shadow-violet-500/5",
        border: "border-violet-500/10",
    },
    green: {
        bg: "bg-emerald-500/10",
        icon: "text-emerald-400",
        shadow: "shadow-emerald-500/5",
        border: "border-emerald-500/10",
    },
    amber: {
        bg: "bg-amber-500/10",
        icon: "text-amber-400",
        shadow: "shadow-amber-500/5",
        border: "border-amber-500/10",
    },
    red: {
        bg: "bg-red-500/10",
        icon: "text-red-400",
        shadow: "shadow-red-500/5",
        border: "border-red-500/10",
    },
    blue: {
        bg: "bg-blue-500/10",
        icon: "text-blue-400",
        shadow: "shadow-blue-500/5",
        border: "border-blue-500/10",
    },
};

export default function StatCard({ title, value, subtitle, icon: Icon, color }: StatCardProps) {
    const c = colorMap[color];

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border ${c.border} ${c.shadow} bg-[#12121a] p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-sm text-gray-400 font-medium">{title}</p>
                    <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-gray-500">{subtitle}</p>
                    )}
                </div>
                <div className={`${c.bg} p-3 rounded-xl`}>
                    <Icon className={`w-6 h-6 ${c.icon}`} />
                </div>
            </div>
            {/* Decorative gradient */}
            <div className={`absolute -bottom-8 -right-8 w-32 h-32 ${c.bg} rounded-full blur-3xl opacity-50`} />
        </div>
    );
}
