"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function PageLayout({ children, title, breadcrumbItems = [] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: userInfo } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (userInfo) {
        localStorage.setItem("user", JSON.stringify(userInfo));
      }

      setLoading(false);
    };

    init();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Generate breadcrumb from pathname if not provided
  const defaultBreadcrumbs = breadcrumbItems.length > 0 
    ? breadcrumbItems 
    : [
        { label: "Dashboard", href: "/dashboard" },
        { label: title || pathname.split("/").pop()?.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Page" },
      ];

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {defaultBreadcrumbs.map((item, index) => {
                const isLast = index === defaultBreadcrumbs.length - 1;
                const itemLabel = typeof item === "string" ? item : item.label;
                const itemHref = typeof item === "string" ? "#" : (item.href || "#");
                
                return (
                  <React.Fragment key={index}>
                    <BreadcrumbItem className={index === 0 ? "hidden md:block" : ""}>
                      {isLast ? (
                        <BreadcrumbPage>{itemLabel}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={itemHref}>
                          {itemLabel}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {title && (
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            </div>
          )}
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

