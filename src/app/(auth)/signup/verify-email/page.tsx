import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm text-center">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
        Please verify your email
      </h1>
      <p className="text-slate-600 dark:text-slate-400 mb-6">
        We&apos;ve sent a confirmation link to your email address. Click the
        link to verify your account, then you can log in.
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
        Didn&apos;t receive the email? Check your spam folder or try signing up
        again.
      </p>
      <Link
        href="/login"
        className="text-primary-600 hover:text-primary-700 font-medium"
      >
        Back to log in
      </Link>
    </div>
  );
}
