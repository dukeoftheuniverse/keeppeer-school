import React, { useState } from 'react';
import { Download, FileArchive, Check, AlertCircle } from 'lucide-react';
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
      <PageTitle subtitle="Download the complete application source as a compressed archive.">
        Download Source Code
      </PageTitle>
      <div className="max-w-lg mx-auto text-center py-10">
        <FileArchive className="w-16 h-16 mx-auto text-[hsl(var(--kp-teal))] mb-4" />
        <p className="text-lg font-semibold text-[hsl(var(--kp-teal))] mb-1">keeppeer-school.tar.gz</p>
        <p className="text-sm text-gray-400 mb-6">Compressed source archive &middot; ~156 KB</p>
        <KpButton onClick={handleDownload} disabled={downloading} className="px-8 py-3 text-base">
          {downloading ? (
            <><Check className="w-5 h-5" /> Starting download...</>
          ) : (
            <><Download className="w-5 h-5" /> Download Source Code</>
          )}
        </KpButton>
        <div className="mt-8 bg-blue-50 rounded-xl p-4 text-left">
          <div className="flex gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold text-blue-700">After downloading</p>
          </div>
          <ol className="text-xs text-blue-600 list-decimal list-inside space-y-0.5 ml-1">
            <li>Extract the .tar.gz file</li>
            <li>Run <code className="bg-blue-100 px-1 rounded">npm install</code></li>
            <li>Run <code className="bg-blue-100 px-1 rounded">npm run dev</code> to start</li>
          </ol>
        </div>
        <p className="text-xs text-gray-300 mt-4">
          If the button doesn't work, copy this link manually:
          <br />
          <span className="break-all text-[hsl(var(--kp-teal-light))]">{DOWNLOAD_URL}</span>
        </p>
      </div>
    </PagePanel>
  );
}