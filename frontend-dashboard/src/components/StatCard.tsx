import { type LucideIcon } from "lucide-react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
}

const neutralStyle = {
    bg: "bg-foreground/[0.03]",
    icon: "text-foreground",
    shadow: "shadow-none",
    border: "border-border",
};


export default function StatCard({ title, value, subtitle, icon: Icon }: StatCardProps) {
    const c = neutralStyle;

    return (
        <div
            className={`relative overflow-hidden rounded-2xl border ${c.border} bg-card backdrop-blur-sm p-6 transition-all duration-300 hover:border-foreground/20`}
        >
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <p className="text-sm text-muted font-serif font-bold">{title}</p>
                    <p className="text-3xl font-bold text-foreground tracking-tight font-dm-sans">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-muted font-dm-sans">{subtitle}</p>
                    )}
                </div>
                <div className={`${c.bg} p-3 rounded-xl border border-border`}>
                    <Icon className={`w-6 h-6 ${c.icon}`} />
                </div>
            </div>
        </div>
    );
}
