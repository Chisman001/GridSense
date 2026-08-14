import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/start-analysis"
      />
    </main>
  );
}
