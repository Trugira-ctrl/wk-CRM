"use client";

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { ThemeProvider } from 'next-themes';
import { useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    mutationCache: new MutationCache({
      onError: (error) => toast({
        title: "Operation could not be completed",
        description: error instanceof Error ? error.message : "Service unavailable. Please try again.",
        variant: "destructive",
      }),
    }),
    defaultOptions: {
      mutations: { retry: false },
      queries: {
        // Reuse the shared snapshot across navigation; refresh in the background.
        // Gate overrides polling while offline, and mutations explicitly refetch.
        staleTime: 15_000,
        refetchInterval: 30_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
