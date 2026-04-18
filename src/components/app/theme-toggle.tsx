"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function ThemeMenuItems() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const active = mounted ? (theme ?? "system") : "system";

  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground">
        Theme
      </DropdownMenuLabel>
      <DropdownMenuCheckboxItem
        checked={active === "system"}
        onCheckedChange={() => setTheme("system")}
      >
        <Monitor className="mr-2 h-4 w-4" /> System
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={active === "light"}
        onCheckedChange={() => setTheme("light")}
      >
        <Sun className="mr-2 h-4 w-4" /> Light
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem
        checked={active === "dark"}
        onCheckedChange={() => setTheme("dark")}
      >
        <Moon className="mr-2 h-4 w-4" /> Dark
      </DropdownMenuCheckboxItem>
      <DropdownMenuSeparator />
    </>
  );
}
