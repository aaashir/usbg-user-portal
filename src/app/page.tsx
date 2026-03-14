import GrantMatches from "@/components/dashboard/GrantMatches";
import ApplicationsInProgress from "@/components/dashboard/UpcomingDeadlines";
import ReadinessChecklist from "@/components/dashboard/ReadinessChecklist";
import AIAssistant from "@/components/dashboard/AIAssistant";
import DocumentVault from "@/components/dashboard/DocumentVault";
import ProgressTracker from "@/components/dashboard/ProgressTracker";

export default function Home() {
  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-8">
        <h1 className="text-3xl sm:text-5xl font-bold text-[#1F315C] tracking-tight mb-2 leading-tight">
          Welcome to Your Grant Portal
        </h1>
        <p className="text-[#3E5A8A] text-lg sm:text-3xl font-semibold">
          Find and Apply for Grants with Ease.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <GrantMatches />
          </div>
          <div>
            <ApplicationsInProgress />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <ReadinessChecklist />
          </div>
          <div>
            <AIAssistant />
          </div>
          <div>
            <DocumentVault />
          </div>
        </div>

        <div>
          <ProgressTracker />
        </div>
      </div>
    </div>
  );
}
