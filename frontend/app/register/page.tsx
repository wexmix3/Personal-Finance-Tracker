"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /register redirects to /login with the register tab pre-selected.
 * Both auth flows live on the same page to share state cleanly.
 */
export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?tab=register");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
