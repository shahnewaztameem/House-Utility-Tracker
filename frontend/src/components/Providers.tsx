'use client';

import { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";

export const Providers = ({ children }: { children: ReactNode }) => {
  return <AuthProvider>{children}</AuthProvider>;
};

