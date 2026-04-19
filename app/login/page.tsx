export default function LoginPage() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f0fdf4'
    }}>
      <div style={{ 
        padding: '2rem', 
        backgroundColor: 'white', 
        borderRadius: '0.5rem',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#22c55e', marginBottom: '1rem' }}>
          CEMMS Login
        </h1>
        <form>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email</label>
            <input 
              type="email" 
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              placeholder="staff@cemms.com"
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password</label>
            <input 
              type="password" 
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
              placeholder="••••••••"
            />
          </div>
          <button 
            type="submit"
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              backgroundColor: '#22c55e', 
              color: 'white', 
              border: 'none', 
              borderRadius: '0.375rem',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
