"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function AuthButton() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabaseBrowser.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!email) {
    return (
      <Button href="/login" variant="secondary">
        ログイン
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="badge">{email}</span>
      <Button
        variant="secondary"
        onClick={async () => {
          await supabaseBrowser.auth.signOut();
          window.location.assign("/login");
        }}
      >
        ログアウト
      </Button>
    </div>
  );
}

