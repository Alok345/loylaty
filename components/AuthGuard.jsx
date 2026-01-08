"use client";

// Simplified AuthGuard - just wraps children
// Individual pages handle their own authentication via PageLayout
export default function AuthGuard({ children }) {
  return <>{children}</>;
}
