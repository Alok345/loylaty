"use client";

import { PageLayout } from "@/components/PageLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <PageLayout title="Dashboard" breadcrumbItems={[
      { label: "Dashboard", href: "/dashboard" },
      { label: "Overview" }
    ]}>
      <div className="space-y-4">
        <div className="grid auto-rows-min gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Dashboard statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-xl bg-muted/50" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Analytics</CardTitle>
              <CardDescription>Performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-xl bg-muted/50" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reports</CardTitle>
              <CardDescription>Latest reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-xl bg-muted/50" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Recent activities and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[400px] rounded-xl bg-muted/50" />
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
