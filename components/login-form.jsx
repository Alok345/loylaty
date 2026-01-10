"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export function LoginForm({ className, ...props }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // ✅ Redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        router.replace("/dashboard");
        router.refresh();
      }
    };

    checkSession();

    // ✅ Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        router.replace("/dashboard");
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleEmailLogin(e) {
    e.preventDefault();
    setLoading(true);

    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        setLoading(false);
        return;
      }

      // ✅ Check if session exists and redirect
      if (data?.session) {
        // Wait a moment for session to be fully established
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Verify session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Redirect to dashboard - loading state will reset on unmount
          router.replace("/dashboard");
        } else {
          alert("Session could not be verified. Please try again.");
          setLoading(false);
        }
      } else {
        alert("Login failed. No session was created.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      alert(err.message || "An error occurred during login");
      setLoading(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleEmailLogin}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">Welcome back</h1>
                <p className="text-muted-foreground">Login to your account</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Checking..." : "Login"}
              </Button>
            </div>
          </form>

          <div className="relative hidden bg-muted md:block">
            <img
              src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRvjBX8WF55YF5vn-iUOUcKULudlcOxs0Gaag&s"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-muted-foreground">
        By continuing, you agree to our Terms & Privacy Policy.
      </div>
    </div>
  );
}
