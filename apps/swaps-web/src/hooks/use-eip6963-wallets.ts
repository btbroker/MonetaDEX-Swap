"use client";

import { useState, useEffect, useCallback } from "react";

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: unknown;
}

const EIP6963_ANNOUNCE = "eip6963:announceProvider";
const EIP6963_REQUEST = "eip6963:requestProvider";

export function useEIP6963Wallets(refreshWhen?: boolean) {
  const [wallets, setWallets] = useState<EIP6963ProviderDetail[]>([]);
  const [isRequesting, setIsRequesting] = useState(false);

  const requestProviders = useCallback(() => {
    if (typeof window === "undefined") return;
    setIsRequesting(true);
    window.dispatchEvent(new Event(EIP6963_REQUEST));
    const t = setTimeout(() => setIsRequesting(false), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onAnnounce = (event: Event) => {
      const e = event as CustomEvent<EIP6963ProviderDetail>;
      if (!e.detail?.info?.uuid) return;
      setWallets((prev) => {
        const exists = prev.some((w) => w.info.uuid === e.detail!.info.uuid);
        if (exists) return prev;
        return [...prev, e.detail];
      });
    };

    window.addEventListener(EIP6963_ANNOUNCE, onAnnounce);
    const clear = requestProviders();

    return () => {
      window.removeEventListener(EIP6963_ANNOUNCE, onAnnounce);
      if (typeof clear === "function") clear();
    };
  }, [requestProviders]);

  useEffect(() => {
    if (typeof window === "undefined" || !refreshWhen) return;
    const clear = requestProviders();
    return () => {
      if (typeof clear === "function") clear();
    };
  }, [refreshWhen, requestProviders]);

  return { wallets, isRequesting, requestProviders };
}
