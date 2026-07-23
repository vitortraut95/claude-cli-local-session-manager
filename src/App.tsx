import { Provider as TooltipProvider } from "@radix-ui/react-tooltip";
import { ToastProvider } from "./components/ToastProvider";
import { SessionsPage } from "./pages/SessionsPage";

export default function App() {
  return (
    <TooltipProvider>
      <ToastProvider>
        <SessionsPage />
      </ToastProvider>
    </TooltipProvider>
  );
}
