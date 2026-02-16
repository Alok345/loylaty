"use client";
import * as React from "react";
import {
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  LayoutDashboard,
  Image,
  Bell,
  UserCircle,
  QrCode,
  ScanLine,
  Gift,
  Award,
  Store,
  Receipt,
  Users,
  Sparkles,
} from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

import { SearchForm } from "@/components/search-form";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      type: "single",
      icon: LayoutDashboard,
    },
    {
      title: "Banners",
      url: "/banners",
      type: "single",
      icon: Image,
    },
    {
      title: "Notifications",
      url: "/notifications",
      type: "single",
      icon: Bell,
    },
    {
      title: "Profile",
      url: "/profiles",
      type: "single",
      icon: UserCircle,
    },
    {
      title: "QR Codes",
      url: "/qr-codes",
      type: "single",
      icon: QrCode,
    },
    {
      title: "QR Scan Logs",
      url: "/qr-scan-logs",
      type: "single",
      icon: ScanLine,
    },
    {
      title: "Redemptions",
      url: "/redemptions",
      type: "single",
      icon: Gift,
    },
    {
      title: "Rewards",
      url: "/rewards",
      type: "single",
      icon: Award,
    },
    {
      title: "Stores",
      url: "/stores",
      type: "single",
      icon: Store,
    },
    {
      title: "Users",
      url: "/users",
      type: "single",
      icon: Users,
    },

    {
      title: "Purchase Orders",
      url: "/purchase-orders",
      type: "single",
      icon: Receipt,
    },
    {
      title: "Dashboard User",
      url: "/user-dashboard",
      type: "single",
      icon: User,
    },
  ],
};

export function AppSidebar(props) {
  const router = useRouter();
  const pathname = usePathname();
  const [expandedDropdowns, setExpandedDropdowns] = useState({});
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          // Get user info from localStorage or fetch from Supabase
          const storedUser = localStorage.getItem("user");
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            // Verify user is still active
            if (parsedUser.status === "active") {
              setUser(parsedUser);
            } else {
              // User is inactive, sign out
              await supabase.auth.signOut();
              localStorage.removeItem("user");
              router.push("/login");
              return;
            }
          } else {
            // Fetch user from users table
            const { data: userInfo, error: userError } = await supabase
              .from("users")
              .select("*")
              .eq("id", session.user.id)
              .single();

            if (userError || !userInfo) {
              console.error("User not found:", userError);
              await supabase.auth.signOut();
              router.push("/login");
              return;
            }

            // Check user status
            if (userInfo.status !== "active") {
              console.error("User account is inactive");
              await supabase.auth.signOut();
              localStorage.removeItem("user");
              router.push("/login");
              return;
            }

            if (userInfo) {
              setUser(userInfo);
              localStorage.setItem("user", JSON.stringify(userInfo));
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [router]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Error logging out:", error);
      // Still redirect even if there's an error
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      router.push("/login");
    }
  }

  const toggleDropdown = (title) => {
    setExpandedDropdowns((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <Sidebar {...props}>
      {/* HEADER LOGO */}
      <SidebarHeader className="border-b border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="gap-3">
              <Link href="/dashboard">
                <div className="flex items-center gap-2">
                  <img src="/icon.png" alt="Logo" className="w-12 h-12" />
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-bold text-base">Shubh Nirman</span>
                    <span className="text-xs text-muted-foreground">Loyalty Application</span>
                  </div>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* <div className="px-2 pt-2">
          <SearchForm />
        </div> */}
      </SidebarHeader>

      {/* MAIN MENU */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-xs font-semibold text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            {data.navMain.map((item) => {
              if (item.type === "single") {
                const isActive = pathname === item.url || pathname.startsWith(item.url + "/");
                const Icon = item.icon || LayoutDashboard;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="group relative gap-3 rounded-lg transition-all duration-200 hover:bg-sidebar-accent/50"
                    >
                      <Link href={item.url}>
                        <Icon
                          className={`size-4 transition-colors ${isActive ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground"}`}
                        />
                        <span className="font-medium">{item.title}</span>
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              }

              if (item.type === "dropdown") {
                const isExpanded = expandedDropdowns[item.title];
                return (
                  <React.Fragment key={item.title}>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => toggleDropdown(item.title)}
                        className="justify-between cursor-pointer"
                      >
                        <span>{item.title}</span>
                        {isExpanded ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronRight className="size-4" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>

                    {/* Dropdown Items */}
                    {isExpanded && (
                      <div className="ml-4 pl-2 border-l-2 border-sidebar-border/50">
                        <SidebarMenu>
                          {item.items.map((subItem) => {
                            const isSubActive =
                              pathname === subItem.url || pathname.startsWith(subItem.url + "/");
                            const SubIcon = subItem.icon;
                            return (
                              <SidebarMenuItem key={subItem.title}>
                                <SidebarMenuButton
                                  asChild
                                  className="pl-6 gap-3 rounded-lg"
                                  isActive={isSubActive}
                                >
                                  <Link href={subItem.url}>
                                    {SubIcon && <SubIcon className="size-4" />}
                                    {subItem.title}
                                  </Link>
                                </SidebarMenuButton>
                              </SidebarMenuItem>
                            );
                          })}
                        </SidebarMenu>
                      </div>
                    )}
                  </React.Fragment>
                );
              }

              return null;
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* USER INFO & LOGOUT */}
      <SidebarFooter className="border-t border-sidebar-border/50 bg-sidebar/50">
        <SidebarGroup>
          <SidebarMenu>
            {/* User Info */}
            {user && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  className="cursor-default gap-3 rounded-lg bg-gradient-to-r from-sidebar-accent/30 to-transparent hover:from-sidebar-accent/40"
                >
                  <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 ring-2 ring-primary/20">
                    <User className="size-5 text-primary" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none text-left flex-1 min-w-0">
                    <span className="font-semibold text-sm truncate">
                      {user.name || user.full_name || user.email?.split("@")[0] || "User"}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {user.email || "No email"}
                    </span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}

            <Separator className="my-2 bg-sidebar-border/50" />

            {/* Logout Button */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleLogout}
                className="w-full gap-3 rounded-lg text-destructive transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4" />
                <span className="font-medium">Logout</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
