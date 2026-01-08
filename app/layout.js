"use client";

import { Inter } from "next/font/google";
import "./globals.css";
import AuthGuard from "@/components/AuthGuard";
// import { SidebarProvider } from "@/components/ui/sidebar";
// import { AppSidebar } from "@/components/app-sidebar";


const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
      {/* <SidebarProvider><AppSidebar /> */}
        <AuthGuard>{children}</AuthGuard>

        {/* </SidebarProvider> */}
      </body>
    </html>
  );
}
