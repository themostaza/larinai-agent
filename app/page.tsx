export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-4xl mx-auto">
          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 sm:mb-8 text-white">
            Technowrapp
            <br />
            <span className="text-gray-400">Agent Commerciale</span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl lg:text-2xl text-gray-300 mb-12 sm:mb-16 leading-relaxed max-w-3xl mx-auto">
            L&apos;agent intelligente accede ai dati del cliente presenti in CRM, database e gestionali aziendali: 
            <span className="text-white font-medium"> dialoga con l&apos;agent per esplorare e analizzare i tuoi dati</span>
          </p>

          {/* CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 sm:mb-24">
            <a 
              href="/sales-agent"
              className="inline-flex items-center justify-center px-12 py-4 text-lg font-semibold text-black bg-white rounded-lg hover:bg-gray-100 transition-all duration-200 min-w-[280px] sm:min-w-[320px]"
            >
              Dialoga con l&apos;Agent
            </a>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12 max-w-5xl mx-auto">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-3">Accesso CRM</h3>
              <p className="text-gray-400 leading-relaxed">Integrazione diretta con i tuoi sistemi CRM e database aziendali</p>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-3">Analisi Intelligente</h3>
              <p className="text-gray-400 leading-relaxed">Elaborazione e analisi avanzata dei dati commerciali</p>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-3">Risposte Immediate</h3>
              <p className="text-gray-400 leading-relaxed">Accesso istantaneo alle informazioni che ti servono</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
