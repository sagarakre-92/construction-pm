import { Toaster } from "sonner";

export default function ORATLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      {children}
      <Toaster position="bottom-center" richColors />
    </div>
  );
}
