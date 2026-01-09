import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotificationsManager } from "./components/common/NotificationsManager";
import { OfflineAlert } from "./components/common/OfflineAlert";
import { Suspense, lazy, useEffect } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));

const App = () => {
  // Handle Deep Links for Email Verification
  useEffect(() => {
    let removed = false;
    let handle: { remove: () => void } | null = null;

    const add = async () => {
      handle = await CapacitorApp.addListener("appUrlOpen", async ({ url }) => {
        if (removed) return;
      console.log('App opened with URL:', url);
      
      // Check if it's a Supabase callback (contains access_token or type=signup)
      if (url.includes('access_token') || url.includes('refresh_token') || url.includes('type=signup')) {
        
        // Convert URL fragment to query params style for parsing
        const fragment = url.split('#')[1];
        if (fragment) {
          const params = new URLSearchParams(fragment);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.error('Error setting session from deep link:', error);
            } else {
              console.log('Session set successfully from deep link');
              // Force reload to update UI state
              window.location.reload();
            }
          }
        }
      }
      });
    };

    add();

    return () => {
      removed = true;
      handle?.remove();
    };
  }, []);

  // Initialize theme based on saved preference
  useEffect(() => {
    const saved = localStorage.getItem("settings_dark_mode");
    const isDark =
      saved !== null ? saved === "true" : window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <NotificationsManager />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
