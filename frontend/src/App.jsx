import { useState } from 'react'
import './App.css'

// URL del backend
let API_URL;
if (window.location.hostname === 'localhost') {
  API_URL = 'https://localhost:4000';
} else {
  API_URL = 'https://192.168.1.207:4000';
}

function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    setError(''); // Limpiar error al escribir
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      //obtener token CSRF
      const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
        credentials: 'include'
      });
      
      if (!csrfResponse.ok) {
        throw new Error('Error obteniendo token CSRF');
      }
      
      const csrfData = await csrfResponse.json();

      // Hacer login o registro
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfData.csrfToken
        },
        body: JSON.stringify({ 
          email: formData.correo, 
          password: formData.password 
        })
      });

      const result = await response.json();

      if (result.ok) {
        setIsLoggedIn(true);
        setFormData({ nombre: '', correo: '', password: '' });
      } else {
        setError(result.error || 'Error en la autenticación');
      }
    } catch (error) {
      console.error("Error:", error);
      setError(error.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      // Obtener CSRF token para logout
      const csrfResponse = await fetch(`${API_URL}/csrf-token`, {
        credentials: 'include'
      });
      
      if (csrfResponse.ok) {
        const csrfData = await csrfResponse.json();
        
        // Hacer logout
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfData.csrfToken
          }
        });
      }
    } catch (error) {
      console.error("Error en logout:", error);
    } finally {
      setIsLoggedIn(false);
    }
  };

  const toggleFormMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setFormData({
      nombre: '',
      correo: '',
      password: ''
    });
  };

  // Si el usuario está logueado, mostrar vista de dashboard
  if (isLoggedIn) {
    return (
      <div className="container mt-5">
        <div className="d-flex justify-content-center">
          <div className="dashboard-container">
            <div className="dashboard-card">
              <h4 className="card-title fw-bold">¡Bienvenido!</h4>
              <p>Has iniciado sesión correctamente.</p>
              <div className="dashboard-actions">
                <button className="btn btn-success me-3" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-5">
      <div className="d-flex justify-content-center">
        <div className="auth-container">
          <div className="auth-header">
            <h4 className="card-title fw-bold">{isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}</h4>
          </div>
          
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="mb-3">
                <label htmlFor="nombre" className="form-label fw-bold">Nombre</label>
                <input
                  type="text"
                  className="form-control full-width-input"
                  id="nombre"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required={!isLogin}
                />
              </div>
            )}
            
            <div className="mb-3">
              <label htmlFor="correo" className="form-label fw-bold">Correo Electrónico</label>
              <input
                type="email"
                className="form-control full-width-input"
                id="correo"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                required
              />
            </div>
            
            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-bold">Contraseña</label>
              <input
                type="password"
                className="form-control full-width-input"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="d-grid gap-2">
              <button 
                type="submit" 
                className="btn btn-success fw-bold"
                disabled={loading}
              >
                {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
              </button>
            </div>
            
            <div className="text-center mt-3">
              <span className="text-white"> 
                {isLogin ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
                <button 
                  type="button" 
                  className="btn-auth-link"
                  onClick={toggleFormMode}
                  disabled={loading}
                >
                  {isLogin ? 'Regístrate aquí' : 'Inicia sesión'}
                </button>
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;