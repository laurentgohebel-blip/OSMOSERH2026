// src/components/Login.jsx
// Page de connexion avec authentification Microsoft

import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

export default function Login() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginPopup(loginRequest)
      .catch(error => console.error('Erreur de connexion:', error));
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Logo de votre solution (marque blanche) */}
        <div style={styles.logo}>
          <h1 style={styles.title}>Synapse RH</h1>
          <p style={styles.subtitle}>Votre solution RH digitale</p>
        </div>

        <button onClick={handleLogin} style={styles.loginButton}>
          <svg style={styles.icon} viewBox="0 0 24 24">
            <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z" />
          </svg>
          Se connecter 
        </button>

        <p style={styles.info}>
          Connectez-vous avec votre compte professionnel
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  card: {
    backgroundColor: 'white',
    padding: '48px',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  logo: {
    marginBottom: '32px',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1a202c',
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '16px',
    color: '#718096',
    margin: 0,
  },
  loginButton: {
    width: '100%',
    padding: '14px 24px',
    fontSize: '16px',
    fontWeight: '600',
    color: 'white',
    backgroundColor: '#0078d4',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
  },
  icon: {
    width: '24px',
    height: '24px',
  },
  info: {
    marginTop: '24px',
    fontSize: '14px',
    color: '#718096',
  }
};
