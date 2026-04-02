import { Brain } from 'lucide-react';

export default function Advisor() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI Advisor</h1>
        <p className="text-muted-foreground text-sm">Your personal financial assistant</p>
      </div>

      <div className="finance-card p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl finance-gradient mx-auto flex items-center justify-center">
          <Brain className="w-8 h-8 text-primary-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Coming Soon</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          The AI Financial Advisor will analyze your spending patterns, provide personalized advice,
          and help you reach your financial goals faster. Connect a backend to enable this feature.
        </p>
      </div>
    </div>
  );
}
