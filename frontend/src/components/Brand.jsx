/** Brand assets: FraudLens mark, Genesis mark, "Powered by Genesis" lockup. Colours follow the active theme. */
export function LensMark({ size = 38 }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="FraudLens logo">
      <path d="M24 3 42 10v13c0 11-7.5 18.5-18 22C13.5 41.5 6 34 6 23V10z" fill="var(--panel-2)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="24" cy="23" r="9" fill="none" stroke="var(--accent)" strokeWidth="2.4" />
      <circle cx="24" cy="23" r="3.4" fill="var(--red)" />
      <path d="M24 10v5M24 31v5M11 23h5M32 23h5" stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

export function GenesisMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Genesis logo">
      <path d="M16 2 28 9v14L16 30 4 23V9z" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M21.5 12.5A6.5 6.5 0 1 0 22 18h-6" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PoweredByGenesis() {
  return (
    <div className="powered" title="Built by Team Genesis">Powered by Genesis</div>
  );
}
