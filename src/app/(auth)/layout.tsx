import { Brand } from "@/components/brand";
import { LanguageSwitch } from "@/components/language-switch";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getT();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <header className="flex items-center justify-between">
          <Brand />
          <LanguageSwitch compact />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
      <AuthArt tagline={t("app.tagline")} />
    </div>
  );
}

// Ilustração feita de raias e cartões: o próprio produto em repouso.
function AuthArt({ tagline }: { tagline: string }) {
  const lanes = [
    [44, 28, 60, 36],
    [52, 40],
    [30, 48, 26],
  ];
  return (
    <aside aria-hidden className="relative hidden overflow-hidden bg-accent lg:flex lg:flex-col lg:justify-between lg:p-12">
      <div className="flex flex-1 items-center justify-center">
        <div className="grid w-full max-w-lg grid-cols-3 gap-4 [transform:rotate(-4deg)]">
          {lanes.map((cards, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-[14px] bg-white/10 p-3">
              <div className="h-2.5 w-1/2 rounded-full bg-white/50" />
              {cards.map((h, j) => (
                <div key={j} className="rounded-[10px] bg-white/90 p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,.5)]" style={{ height: h + 32 }}>
                  <div className="h-2 w-3/4 rounded-full bg-[#2c46cc]/30" />
                  <div className="mt-2 h-2 w-1/2 rounded-full bg-[#161920]/15" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <p className="max-w-sm text-2xl font-medium leading-snug tracking-tight text-white">{tagline}</p>
    </aside>
  );
}
