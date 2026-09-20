import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { Footer } from "@/components/Footer";
import { ChatBot } from "@/components/ChatBot";
import { IS_DEMO } from "@/lib/auth-mode";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        <Footer />
      </div>
      {!IS_DEMO && <ChatBot />}
    </div>
  );
}
