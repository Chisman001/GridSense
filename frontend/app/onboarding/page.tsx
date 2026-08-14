import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { resolveBusiness } from "@/lib/energy-records";

import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-up");
  }

  const business = await resolveBusiness(userId);

  if (business) {
    redirect("/dashboard");
  }

  return <OnboardingForm />;
}
