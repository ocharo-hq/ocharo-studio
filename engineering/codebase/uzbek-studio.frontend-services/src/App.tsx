import { useEffect, useState } from 'react';

/** Shape returned by GET /api/greeting (see GreetingController). */
interface GreetingResponse {
  message: string;
}

/** Root of the UzbekStudio UI — fetches the greeting from the .NET API and shows it. */
export default function App() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/greeting', { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        }
        const body = (await res.json()) as GreetingResponse;
        setMessage(body.message);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Request failed');
      });

    return () => controller.abort();
  }, []);

  return (
    <main
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '40rem',
        margin: '4rem auto',
        padding: '0 1.5rem',
      }}
    >
      <h1>UzbekStudio</h1>
      <p style={{ color: '#666' }}>Minimal Vite + React 19 frontend, served from the .NET host.</p>

      <section
        style={{
          marginTop: '2rem',
          padding: '1.25rem',
          border: '1px solid #ddd',
          borderRadius: '0.5rem',
        }}
      >
        <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#888' }}>
          GET /api/greeting
        </h2>
        {error && <p style={{ color: '#c00' }}>Error: {error}</p>}
        {!error && message === null && <p>Loading…</p>}
        {!error && message !== null && <p style={{ fontSize: '1.25rem' }}>{message}</p>}
      </section>
    </main>
  );
}
