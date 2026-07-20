import React, { useState } from 'react';
import { Download, FileArchive, Database, Server, Check } from 'lucide-react';
import { PagePanel, PageTitle, KpButton } from '@/components/kp/ui';

const DOWNLOAD_URL =
  'https://base44.app/api/apps/6a599666b848d4d07cd0e975/files/mp/public/6a599666b848d4d07cd0e975/71dcde016_keeppeer-schooltar.gz';

export default function DownloadSource() {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = () => {
    setDownloading(true);
    const a = document.createElement('a');
    a.href = DOWNLOAD_URL;
    a.download = 'keeppeer-school.tar.gz';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 1500);
  };

  return (
    <PagePanel>
      <PageTitle subtitle="A complete, Base44-free build with a local MySQL database — ready to export and run on your own machine.">
        Download Source Code
      </PageTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="kp-panel-translucent rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-[hsl(var(--kp-teal))]"><Server className="w-4 h-4" /><h3 className="text-sm font-bold">Standalone Backend</h3></div>
          <p className="text-xs text-gray-500">Express + MySQL API in <code className="bg-gray-100 px-1 rounded">server/</code>. Auto-migrates every entity into MySQL tables. JWT auth, file uploads, and integration stubs — no Base44 SDK.</p>
        </div>
        <div className="kp-panel-translucent rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2 text-[hsl(var(--kp-teal))]"><Database className="w-4 h-4" /><h3 className="text-sm font-bold">MySQL Database</h3></div>
          <p className="text-xs text-gray-500">Tables are generated from <code className="bg-gray-100 px-1 rounded">base44/entities/*.jsonc</code>. Run <code className="bg-gray-100 px-1 rounded">npm run migrate</code> and the full schema is created automatically.</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto text-center py-6">
        <FileArchive className="w-14 h-14 mx-auto text-[hsl(var(--kp-teal))] mb-3" />
        <p className="text-lg font-semibold text-[hsl(var(--kp-teal))] mb-1">keeppeer-school.tar.gz</p>
        <p className="text-sm text-gray-400 mb-5">Full source archive · standalone MySQL edition</p>
        <KpButton onClick={handleDownload} disabled={downloading} className="px-8 py-3 text-base">
          {downloading ? <><Check className="w-5 h-5" /> Starting download...</> : <><Download className="w-5 h-5" /> Download Source Code</>}
        </KpButton>
      </div>

      <div className="kp-panel-translucent rounded-2xl p-4 max-w-2xl mx-auto">
        <h3 className="text-sm font-bold text-[hsl(var(--kp-teal))] mb-3">Run locally with MySQL</h3>
        <ol className="text-sm text-gray-600 list-decimal list-inside space-y-2">
          <li>Extract the archive and open a terminal in the project folder.</li>
          <li>Start the backend:<br /><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">cd server &amp;&amp; cp .env.example .env</code> (edit DB creds) <br /><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">npm install &amp;&amp; npm run migrate &amp;&amp; npm start</code></li>
          <li>Swap in the standalone client files (from <code className="bg-gray-100 px-1 rounded">standalone/</code>) over the Base44 originals:<br /><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">cp -r standalone/src/* src/</code></li>
          <li>Run the frontend:<br /><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">cp standalone/.env.example .env &amp;&amp; npm install &amp;&amp; npm run dev</code></li>
        </ol>
        <p className="text-xs text-gray-400 mt-3">Full step-by-step guide is in <code className="bg-gray-100 px-1 rounded">STANDALONE-SETUP.md</code> inside the archive.</p>
      </div>

      <p className="text-xs text-gray-300 mt-4 text-center">
        If the button doesn't work, copy this link manually:
        <br /><span className="break-all text-[hsl(var(--kp-teal-light))]">{DOWNLOAD_URL}</span>
      </p>
    </PagePanel>
  );
}