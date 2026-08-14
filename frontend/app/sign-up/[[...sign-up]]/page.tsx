import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/login"
        fallbackRedirectUrl="/start-analysis"
        forceRedirectUrl="/start-analysis"
      />
    </main>
  );
}