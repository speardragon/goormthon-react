import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [apiData, setApiData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/config/config.json')
      .then((res) => res.json())
      .then((config) => {
        const apiUrl = config.REACT_APP_API_URL;
        return fetch(apiUrl);
      })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        setApiData(data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>API Response</h1>
        {loading && <p>Loading...</p>}
        {error && (
          <p style={{ color: '#ff6b6b' }}>Error: {error}</p>
        )}
        {apiData && (
          <pre
            style={{
              textAlign: 'left',
              background: '#1e1e1e',
              padding: '1.5rem',
              borderRadius: '8px',
              maxWidth: '800px',
              width: '100%',
              overflowX: 'auto',
              fontSize: '0.875rem',
              lineHeight: '1.6',
            }}
          >
            {JSON.stringify(apiData, null, 2)}
          </pre>
        )}
      </header>
    </div>
  );
}

export default App;
