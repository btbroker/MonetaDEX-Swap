import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../providers/wagmi-provider";

export const metadata: Metadata = {
  title: "MonetaDEX - Best Rates Across All DEXs",
  description: "Swap tokens across multiple chains with the best rates. Aggregated liquidity from top DEXs and bridges.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
