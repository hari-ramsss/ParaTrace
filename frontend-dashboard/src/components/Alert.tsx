"use client";

import { X } from "lucide-react";

interface AlertProps {
    variant: "error" | "warning" | "info" | "success";
    title?: string;
    message: string;
    icon?: React.ReactNode;
    action?: {
        label: string;
        onClick: () => void;
    };
    dismissible?: boolean;
    onDismiss?: () => void;
}

const variantStyles = {
    error: {
        container: "bg-red-500/10 border-red-500/20",
        text: "text-red-400",
        button: "bg-red-500/20 hover:bg-red-500/30 text-red-400",
    },
    warning: {
        container: "bg-amber-500/10 border-amber-500/20",
        text: "text-amber-400",
        button: "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400",
    },
    info: {
        container: "bg-blue-500/10 border-blue-500/20",
        text: "text-blue-400",
        button: "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400",
    },
    success: {
        container: "bg-emerald-500/10 border-emerald-500/20",
        text: "text-emerald-400",
        button: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400",
    },
};

export default function Alert({
    variant,
    title,
    message,
    icon,
    action,
    dismissible,
    onDismiss,
}: AlertProps) {
    const styles = variantStyles[variant];

    return (
        <div
            className={`mb-6 p-4 rounded-xl border ${styles.container} ${styles.text} text-sm animate-fade-in relative`}
        >
            <div className="flex items-start gap-3">
                {icon && <div className="shrink-0 mt-0.5">{icon}</div>}

                <div className="flex-1">
                    {title && (
                        <h4 className="font-bold mb-1">{title}</h4>
                    )}
                    <p className="opacity-90">{message}</p>

                    {action && (
                        <button
                            onClick={action.onClick}
                            className={`mt-3 px-4 py-2 rounded-lg ${styles.button} font-medium text-xs transition-all active:scale-95`}
                        >
                            {action.label}
                        </button>
                    )}
                </div>

                {dismissible && onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="shrink-0 p-1 rounded-lg hover:bg-current/10 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
