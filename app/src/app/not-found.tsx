import Link from "next/link";
export default function NotFound() {
  return (
    <div className="tile" style={{ alignItems: "flex-start" }}>
      <h1 style={{ fontSize: 28 }}>Táto stránka neexistuje</h1>
      <p className="muted">Seriál mohol byť odstránený alebo je odkaz nesprávny.</p>
      <Link className="btn" href="/katalog">Prejsť do katalógu</Link>
    </div>
  );
}
