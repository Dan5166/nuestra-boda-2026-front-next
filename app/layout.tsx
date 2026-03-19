import type { Metadata } from "next";
import "./globals.css";
import Navbar from "./components/Navbar";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Dominic & Danyael | Nuestra Boda 2026",
  description:
    "Te invitamos a celebrar nuestro matrimonio · 19 de abril de 2026",
  openGraph: {
    title: "Dominic & Danyael",
    description: "Nuestra boda · 19 de abril de 2026",
    images: [
      {
        url: "https://www.nuestraboda2026.cl/og-image.webp",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" type="image/svg+xml" href="/bride.svg" />
      </head>
      <body>
        <Suspense>
          <Navbar />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
