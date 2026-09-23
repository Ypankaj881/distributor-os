export default function Checkbox({ label, description, className, ...props }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 ${className ?? ""}`}>
      <input type="checkbox" className="mt-0.5 size-5 rounded border-slate-300 accent-brand-600" {...props} />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {description && <span className="block text-sm text-slate-500">{description}</span>}
      </span>
    </label>
  );
}
