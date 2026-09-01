import { Provider as TooltipProvider } from "@radix-ui/react-tooltip";
import { LanguageProvider } from "./components/LanguageProvider";
import { ToastProvider } from "./components/ToastProvider";
import { SessionsPage } from "./pages/SessionsPage";

export default function App() {
  return (
    <TooltipProvider>
      <LanguageProvider>
        <ToastProvider>
          <SessionsPage />
        </ToastProvider>
      </LanguageProvider>
    </TooltipProvider>
  );
}
