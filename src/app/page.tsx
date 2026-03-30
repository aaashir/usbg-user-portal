import GrantMatches from "@/components/dashboard/GrantMatches";
import ApplicationsInProgress from "@/components/dashboard/UpcomingDeadlines";
import ReadinessChecklist from "@/components/dashboard/ReadinessChecklist";
import AIAssistant from "@/components/dashboard/AIAssistant";
import DocumentVault from "@/components/dashboard/DocumentVault";
import ProgressTracker from "@/components/dashboard/ProgressTracker";

export default function Home() {
  return (
    <div>
      <header className="mb-8 animate-fade-up delay-0">
        <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold text-[#1F315C] tracking-tight mb-2 leading-tight">
          Welcome to Your Grant Portal
        </h1>
        <p className="text-[#3E5A8A] text-base sm:text-lg lg:text-3xl font-semibold">
          Access Current Grant Opportunities and Application Materials.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="animate-fade-up delay-75">
            <GrantMatches />
          </div>
          <div className="animate-fade-up delay-150">
            <ApplicationsInProgress />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="animate-fade-up delay-225">
            <ReadinessChecklist />
          </div>
          <div className="animate-fade-up delay-300">
            <AIAssistant />
          </div>
          <div className="animate-fade-up delay-375">
            <DocumentVault />
          </div>
        </div>

        <div className="animate-fade-up delay-450">
          <ProgressTracker />
        </div>
      </div>
    </div>
  );
}
