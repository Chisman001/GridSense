import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { resolveBusiness } from "@/lib/energy-records";

export default async function StartAnalysisPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-up");
  }

  const business = await resolveBusiness(userId);

  if (!business) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
