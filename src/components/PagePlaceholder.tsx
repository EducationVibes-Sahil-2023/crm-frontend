import { Icon, type IconName } from "@/components/icons";

export default function PagePlaceholder({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: IconName;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Icon name={icon} className="h-8 w-8" />
        </div>
        <p className="mt-4 text-lg font-semibold text-slate-800">
          {title} is coming soon
        </p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          This module is part of the Nexus CRM suite and is currently under
          construction.
        </p>
      </div>
    </div>
  );
}
