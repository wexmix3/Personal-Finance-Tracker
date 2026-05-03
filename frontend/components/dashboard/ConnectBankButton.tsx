"use client";

import { useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Landmark, Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api";

interface Props {
  onSuccess: () => void;
  variant?: "default" | "empty-state";
}

function PlaidLinkInner({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: () => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: async (_publicToken, metadata) => {
      try {
        await apiPost("/api/plaid/exchange-token", {
          public_token: _publicToken,
          institution_name: metadata.institution?.name ?? null,
        });
        onSuccess();
      } catch (err) {
        console.error("Plaid exchange error", err);
        onExit();
      }
    },
    onExit: () => onExit(),
  });

  // Open as soon as Plaid Link is ready
  useEffect(() => {
    if (ready) open();
  }, [ready, open]);

  return null;
}

export function ConnectBankButton({ onSuccess, variant = "default" }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const data = await apiPost<object, { link_token: string }>(
        "/api/plaid/create-link-token",
        {}
      );
      setLinkToken(data.link_token);
    } catch (err) {
      console.error("Failed to create link token", err);
      setLoading(false);
    }
  };

  const handleExit = () => {
    setLinkToken(null);
    setLoading(false);
  };

  const handleSuccess = () => {
    setLinkToken(null);
    setLoading(false);
    onSuccess();
  };

  if (variant === "empty-state") {
    return (
      <>
        {linkToken && (
          <PlaidLinkInner
            token={linkToken}
            onSuccess={handleSuccess}
            onExit={handleExit}
          />
        )}
        <button
          onClick={handleClick}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Landmark size={15} />
          )}
          {loading ? "Connecting…" : "Connect Bank Account"}
        </button>
      </>
    );
  }

  return (
    <>
      {linkToken && (
        <PlaidLinkInner
          token={linkToken}
          onSuccess={handleSuccess}
          onExit={handleExit}
        />
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
        ) : (
          <Landmark size={14} className="text-primary" />
        )}
        {loading ? "Connecting…" : "Connect Bank"}
      </button>
    </>
  );
}
