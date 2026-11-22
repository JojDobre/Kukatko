"use client";
/** Znovu otvorí okno súhlasu s cookies od Google (Privacy & messaging v AdSense). */
export default function PrivacyLink({ label }: { label: string }) {
  return (
    <button className="link" onClick={() => {
      const w = window as any;
      w.googlefc = w.googlefc || {};
      w.googlefc.callbackQueue = w.googlefc.callbackQueue || [];
      w.googlefc.callbackQueue.push(() => w.googlefc.showRevocationMessage?.());
    }}>{label}</button>
  );
}
