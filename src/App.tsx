import { Provider as TooltipProvider } from "@radix-ui/react-tooltip";
import { LanguageProvider } from "./components/LanguageProvider";
import { ToastProvider } from "./components/ToastProvider";
import { AppShell } from "./components/AppShell";

export default function App() {
  return (
    <TooltipProvider>
      <LanguageProvider>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </LanguageProvider>
    </TooltipProvider>
  );
}
