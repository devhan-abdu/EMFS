import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Login | EMFS",
  description: "Sign in to the EMFS admin dashboard",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <LoginForm />
    </div>
  );
}
